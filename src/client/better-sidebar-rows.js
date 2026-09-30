// ---------------------------------------------------------------------------
// E · 把小鱼挂到 dsh-better-sidebar「任务管理」页已有的子代理行上
//
// 为什么是这种方式，而不是像原来那样注册一个新标签页：
//
//   - 那个页面是 better-sidebar 内置的 `subagent` 标签（中文名「任务管理」），
//     渲染的是它自己的 SubagentView，**每一行没有留任何扩展口**；
//   - 想用同 id 顶掉它也不行 —— 它的 registerTab 遇到重复 id 会直接抛错
//     （"tab type already registered"），内置标签走的是同一个注册表。
//
// 所以只剩一条路：等它把行渲染出来，再把鱼插进去。这是全插件唯一一处依赖
// 别人 DOM 的地方，因此写得尽量防守：
//
//   - 锚点用 role="treeitem" + aria-level 这组 ARIA 语义，而不是 CSS 类名；
//   - 必须同时找得到子代理行专有的标签元素才动手，所以不会误伤文件树等
//     别的 treeitem；
//   - 从行里的文字反查子代理 id，查不到就**什么都不做**，绝不猜；
//   - better-sidebar 升级把这套结构改掉时，最坏的结果是鱼不出现，
//     不会把它的页面弄坏。
//
// 本文件由 tools/build-client.mjs 拼进 lib/client.js，共用同一个作用域。
// ---------------------------------------------------------------------------

/** 子代理行的锚点：ARIA 树节点。 */
const SUBAGENT_ROW_SELECTOR = '[role="treeitem"][aria-level]'
/** 子代理行独有的标签元素（类名带内容哈希前缀，所以只匹配后缀）。 */
const SUBAGENT_LABEL_SELECTOR = '[class*="_subagentLabel"]'
/** 处理过的行打上这个标记，重复扫描不会插第二条。 */
const ROW_MARK = 'dsfFishId'
/** 连续多少次扫描一个子代理行都没找到，就彻底放弃（避免永远空转）。 */
const MAX_EMPTY_SCANS = 40

/**
 * 从会话列表里建「行文字 → 子代理 id」的索引。
 *
 * 命名规则与 better-sidebar 自己完全一致（entry.label → displayTitle → id），
 * 否则行里显示的名字和这里算出来的对不上，鱼就挂不上去。
 *
 * @param list - ctx.sessions.list 的快照。
 * @returns label → sessionId。
 */
function subagentIdsByLabel(list) {
  const byLabel = new Map()
  const projections = list?.projectionsBySession
  if (projections === null || typeof projections !== 'object') return byLabel
  for (const projection of Object.values(projections)) {
    const entries = projection?.values?.subagentCatalog
    if (!Array.isArray(entries)) continue
    for (const entry of entries) {
      if (entry === null || typeof entry !== 'object' || typeof entry.id !== 'string') continue
      const summary = list.byId?.[entry.id]
      const label = entry.label ?? summary?.displayTitle ?? entry.id
      if (typeof label === 'string' && label.length > 0 && !byLabel.has(label)) {
        byLabel.set(label, entry.id)
      }
    }
  }
  return byLabel
}

/** 一条行对应的鱼该是什么状态。 */
function rowFishState(list, sessionId) {
  return list?.byId?.[sessionId]?.running === true ? 'running' : 'done'
}

/**
 * 装好这套「往行上挂鱼」的观察器。
 *
 * @param ctx - 客户端 cordis 上下文（只需要 ctx.sessions）。
 * @returns 卸载函数：断开观察、并把自己插进去的鱼收干净。
 */
function installSidebarRowFish(ctx) {
  const sessions = ctx.sessions
  // 少任何一个前提就安静地什么都不做。这一处是整个插件唯一碰别人 DOM 的地方，
  // 绝不能因为环境缺个 API 就把 apply() 抛出去 —— 那会连带 D 一起失效。
  if (sessions === undefined || sessions === null) return () => {}
  if (typeof document === 'undefined' || typeof MutationObserver !== 'function') return () => {}

  let pending = false
  let emptyScans = 0
  let disposed = false

  /** 扫描并给尚未挂鱼的行补上鱼。 */
  const decorate = () => {
    pending = false
    if (disposed) return
    const rows = document.querySelectorAll(`${SUBAGENT_ROW_SELECTOR}`)
    if (rows.length === 0) return
    const list = sessions.list.getSnapshot()
    const byLabel = subagentIdsByLabel(list)
    let touched = 0
    for (const row of rows) {
      const labelElement = row.querySelector(SUBAGENT_LABEL_SELECTOR)
      if (labelElement === null) continue
      const label = labelElement.textContent?.trim()
      if (label === undefined || label.length === 0) continue
      const sessionId = byLabel.get(label)
      // 查不到就不动它 —— 宁可少挂一条鱼，也不要挂错人。
      if (sessionId === undefined) continue
      const state = rowFishState(list, sessionId)
      const existing = row.querySelector('.dsf-row-fish')
      if (existing !== null) {
        // 行还在，但状态变了（开跑或跑完）：换掉这条鱼，让它开始 / 停止游动。
        if (existing.getAttribute('data-dsf-state') === state) continue
        existing.innerHTML = fishAvatarMarkup(fishIdentity(sessionId), shouldFishSwim(state))
        existing.setAttribute('data-dsf-state', state)
        touched += 1
        continue
      }
      const host = document.createElement('span')
      host.className = 'dsf-row-fish'
      host.setAttribute('data-dsf-state', state)
      host.innerHTML = fishAvatarMarkup(fishIdentity(sessionId), shouldFishSwim(state))
      row.insertBefore(host, row.firstChild)
      row.setAttribute(ROW_MARK, sessionId)
      touched += 1
    }
    if (touched > 0) {
      emptyScans = 0
      // 行是别的插件画的，它的重画会把鱼换掉；这里动完之后必须显式叫醒游动
      // 循环 —— 缓存命中时 fishSvg 不会跑，循环停了就没人重启它。
      // 只有真的挂了「该游的鱼」才需要叫。
      if (rows.length > 0) ensureFishSwimming()
      return
    }
    // 没有任何一行认得出来：可能是这个页面根本没打开，也可能 better-sidebar
    // 换了结构。数够次数就停，不长期占着观察器。
    const anyMarked = document.querySelector(`[${ROW_MARK}]`) !== null
    if (!anyMarked && ++emptyScans > MAX_EMPTY_SCANS) observer.disconnect()
  }

  /** 合并同一轮里的多次 DOM 变动。 */
  const schedule = () => {
    if (pending || disposed) return
    pending = true
    queueMicrotask(decorate)
  }

  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })

  // 会话列表本身的变化（跑完 / 新起子代理）也要跟着刷新状态。
  const unsubscribe = typeof sessions.list.subscribe === 'function'
    ? sessions.list.subscribe(schedule)
    : () => {}
  schedule()

  return () => {
    disposed = true
    observer.disconnect()
    unsubscribe()
    for (const row of document.querySelectorAll(`[${ROW_MARK}]`)) {
      row.querySelector('.dsf-row-fish')?.remove()
      row.removeAttribute(ROW_MARK)
    }
  }
}
