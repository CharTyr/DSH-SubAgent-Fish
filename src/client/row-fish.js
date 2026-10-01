// ---------------------------------------------------------------------------
// 往别的插件渲染出来的「行」上挂小鱼。
//
// 目前两处，都是同样的处境 —— 那些行不是本插件画的，也没留扩展口：
//
//   1. dsh-better-sidebar「任务管理」页的子代理行
//      （它内置的 subagent 标签渲染 SubagentView，行级没有扩展口；
//        同 id 接管又会被它的 registerTab 直接抛错拒绝）
//   2. DSH「智能体团队」成员行
//      （团队插件只注册了会话标题栏的一个按钮，名单面板是它自己画的）
//
// 所以只能等它们渲染完再把鱼插进去。这是全插件唯一碰别人 DOM 的地方，
// 因此两处共用一套防守写法：
//
//   - 锚点优先用语义标记（role/aria、data-team-action），其次才用类名 ——
//     而且只匹配**类名的后缀**（_member、_subagentLabel），因为插件构建时
//     会给类名加内容哈希前缀；
//   - 必须同时找得到该界面专有的名字元素才动手，所以不会互相误伤；
//   - 从行里的文字反查会话 id，查不到就**什么都不做**，绝不猜；
//   - 升级把结构改掉时，最坏结果是鱼不出现，不会把别人的页面弄坏。
//
// 本文件由 tools/build-client.mjs 拼进 lib/client.js，共用同一个作用域。
// ---------------------------------------------------------------------------

/** 行处理过的标记，避免重复插鱼。 */
const ROW_MARK = 'dsfFishId'
/** 连续多少轮一行都认不出来就断开观察器，免得长期空转。 */
const MAX_EMPTY_SCANS = 40

/**
 * 每一处要挂鱼的行：去哪儿找、怎么认出「行」、从哪个元素读名字。
 *
 * `scopes` 是作用域选择器；空数组表示在整个文档里找 —— 但每处都靠
 * `nameSuffix` 再筛一道，所以不会互相误伤。
 */
const ROW_SURFACES = [
  {
    id: 'better-sidebar-subagents',
    scopes: ['body'],
    rowSelector: '[role="treeitem"][aria-level]',
    nameSuffix: '_subagentLabel',
  },
  {
    id: 'agent-team-members',
    scopes: ['[data-team-action]'],
    rowSelector: 'button',
    rowClassSuffix: '_member',
    nameSuffix: '_memberNameText',
  },
]

/** 元素的 classList 里有没有以 `suffix` 结尾的类名（构建会加哈希前缀）。 */
function hasClassTokenEndingWith(element, suffix) {
  const tokens = element.classList
  if (tokens === undefined || tokens === null) return false
  for (const token of tokens) {
    if (token.endsWith(suffix)) return true
  }
  return false
}

/** 在该元素里找「以某后缀结尾的类名」的后代。 */
function findDescendantByClassSuffix(element, suffix) {
  for (const candidate of element.querySelectorAll('[class]')) {
    if (hasClassTokenEndingWith(candidate, suffix)) return candidate
  }
  return null
}

/**
 * 会话列表 → 「行上显示的文字 → 会话 id」。
 *
 * 两处行都显示同一类东西：子代理目录条目、或团队成员。命名规则与它们各自的
 * 显示逻辑保持一致（有专门的名字就用，否则用会话标题，再否则用 id），否则
 * 行里的字和这里算出来的对不上，鱼就挂不上去。
 *
 * @param list - ctx.sessions.list 的快照。
 * @returns label → sessionId。
 */
function sessionIdsByLabel(list) {
  const byLabel = new Map()
  const projections = list?.projectionsBySession
  if (projections === null || typeof projections !== 'object') return byLabel
  const remember = (id, preferred) => {
    if (typeof id !== 'string' || id.length === 0) return
    const label = preferred ?? list.byId?.[id]?.displayTitle ?? id
    if (typeof label === 'string' && label.length > 0 && !byLabel.has(label)) byLabel.set(label, id)
  }
  for (const projection of Object.values(projections)) {
    const values = projection?.values
    if (values === null || typeof values !== 'object') continue
    // 子代理目录
    const catalog = values.subagentCatalog
    if (Array.isArray(catalog)) {
      for (const entry of catalog) {
        if (entry === null || typeof entry !== 'object') continue
        remember(entry.id, entry.label)
      }
    }
    // 智能体团队的成员
    const members = values.agentTeam?.members
    if (Array.isArray(members)) {
      for (const member of members) {
        if (member === null || typeof member !== 'object') continue
        remember(member.id, member.name)
      }
    }
  }
  return byLabel
}

/**
 * 装好「往行上挂鱼」这套观察器。
 *
 * @param ctx - 客户端 cordis 上下文（只需要 ctx.sessions）。
 * @returns 卸载函数：断开观察、并把自己插进去的鱼收干净。
 */
function installRowFish(ctx) {
  const sessions = ctx.sessions
  // 少任何一个前提就安静地什么都不做。这一处是整个插件唯一碰别人 DOM 的地方，
  // 绝不能因为环境缺个 API 就把 apply() 抛出去 —— 那会连带 D 一起失效。
  if (sessions === undefined || sessions === null) return () => {}
  if (typeof document === 'undefined' || typeof MutationObserver !== 'function') return () => {}

  let pending = false
  let emptyScans = 0
  let disposed = false

  /** 收集当前页面上所有认得出来的行。 */
  const collectRows = () => {
    const found = []
    for (const surface of ROW_SURFACES) {
      for (const scope of surface.scopes) {
        // 用 document 当根而不是 document.body：后者在脚本跑得早时可能是 null，
        // 而 querySelectorAll 在两者上都能用。
        const roots = scope === 'body' ? [document] : document.querySelectorAll(scope)
        for (const root of roots) {
          if (root === null || root === undefined) continue
          for (const row of root.querySelectorAll(surface.rowSelector)) {
            if (surface.rowClassSuffix !== undefined
              && !hasClassTokenEndingWith(row, surface.rowClassSuffix)) continue
            const nameElement = findDescendantByClassSuffix(row, surface.nameSuffix)
            if (nameElement === null) continue
            found.push({ row, nameElement })
          }
        }
      }
    }
    return found
  }

  /** 扫描并给尚未挂鱼的行补上鱼。 */
  const decorate = () => {
    pending = false
    if (disposed) return
    const rows = collectRows()
    if (rows.length === 0) {
      if (++emptyScans > MAX_EMPTY_SCANS) observer.disconnect()
      return
    }
    const list = sessions.list.getSnapshot()
    const byLabel = sessionIdsByLabel(list)
    let touched = 0
    for (const { row, nameElement } of rows) {
      const label = nameElement.textContent?.trim()
      if (label === undefined || label.length === 0) continue
      const sessionId = byLabel.get(label)
      // 查不到就不动它 —— 宁可少挂一条鱼，也不要挂错人。
      if (sessionId === undefined) continue
      const state = list?.byId?.[sessionId]?.running === true ? 'running' : 'done'
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
    if (touched === 0) return
    emptyScans = 0
    // 行是别的插件画的，它的重画会把鱼换掉；这里动完之后必须显式叫醒游动
    // 循环 —— 缓存命中时 fishSvg 不会跑，循环停了就没人重启它。
    ensureFishSwimming()
  }

  /** 合并同一轮里的多次 DOM 变动。 */
  const schedule = () => {
    if (pending || disposed) return
    pending = true
    queueMicrotask(decorate)
  }

  const observer = new MutationObserver(schedule)
  observer.observe(document.body, { childList: true, subtree: true })

  // 会话列表本身的变化（跑完 / 新起子代理 / 团队换人）也要跟着刷新状态。
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
