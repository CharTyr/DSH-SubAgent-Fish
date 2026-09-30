// ---------------------------------------------------------------------------
// E · dsh-better-sidebar 里的「子代理 · 小鱼」页面
//
// better-sidebar 对外公开了一个服务：别的插件可以往它的侧边栏里注册自己的
// 标签页（ctx.betterSidebar.registerTab）。这里用它注册一整页：当前会话树上的
// 全部子代理，每个都带自己的小鱼。
//
// 关键在于**这不是替换**：DSH 和 better-sidebar 原本的子代理页面原样保留，
// 这只是多出来的一页。better-sidebar 没装时注册不了，这一页自然消失，
// 不影响 D（右侧栏标签）。
//
// 数据全部来自客户端已有的会话列表快照，不新增任何主机侧接口。
//
// 本文件由 tools/build-client.mjs 拼进 lib/client.js，共用同一个作用域。
// ---------------------------------------------------------------------------

/** 标签页在 better-sidebar 里的 id（也是它的 SidebarTab.type）。 */
const BETTER_TAB_ID = 'dsh-subagent-fish:shoal'

/** 展开层数的上限，防止异常的父子链把渲染拖垮。 */
const MAX_FISH_DEPTH = 4

/** 订阅会话列表快照（better-sidebar 的 sessions 服务只有 list 这一个订阅口）。 */
function useSessionList(sessions) {
  return React.useSyncExternalStore(
    (notify) => sessions.list.subscribe(notify),
    () => sessions.list.getSnapshot(),
  )
}

/** 一条子代理目录记录 → 我们关心的字段。 */
function catalogEntriesOf(list, sessionId) {
  const projection = list.projectionsBySession?.[sessionId]
  const entries = projection?.values?.subagentCatalog
  return Array.isArray(entries) ? entries : []
}

/**
 * 这个会话自己的父会话 id（不是子代理时为 undefined）。
 *
 * 会话列表摘要里直接带 `parentId` 与 `origin: 'subagent'`——不要去找
 * `subagent.address`，那个结构不在列表快照里。
 */
function parentOf(list, sessionId) {
  const snapshot = list.byId?.[sessionId]
  const parentId = snapshot?.parentId
  return typeof parentId === 'string' && parentId.length > 0 ? parentId : undefined
}

/**
 * 沿父链上溯到主会话。
 *
 * 根节点是「第一个不是子代理的会话」——和 better-sidebar 自己的子代理页同一套
 * 判定；所以不管你现在停在哪个子代理里，看到的都是整棵树。
 */
function rootSessionOf(list, startId) {
  let current = startId
  const seen = new Set()
  for (let hop = 0; hop <= MAX_FISH_DEPTH + 8; hop++) {
    if (current === undefined || seen.has(current)) return current
    seen.add(current)
    const parent = parentOf(list, current)
    if (parent === undefined) return current
    current = parent
  }
  return current
}

/**
 * 一个会话显示什么名字。
 *
 * 顺序：子代理目录里那条持久化的 label（只有子代理行有）→ 会话摘要的
 * `displayTitle` → 调用方给的兜底文案 → 会话 id。
 * 列表快照里没有 `projectionValues`，只有摘要字段。
 *
 * @param preferred - 目录条目自带的 label；没有就传 undefined。
 * @param fallback - 连 displayTitle 都没有时的兜底。
 */
function labelOf(list, sessionId, preferred, fallback) {
  if (typeof preferred === 'string' && preferred.length > 0) return preferred
  const title = list.byId?.[sessionId]?.displayTitle
  if (typeof title === 'string' && title.length > 0) return title
  return fallback ?? sessionId
}

/** 一个会话是否正在跑。 */
function isRunning(list, sessionId) {
  return list.byId?.[sessionId]?.running === true
}

/**
 * 一个会话的状态：只用来决定鱼的明暗。
 *
 * 会话摘要只给出 `running`，没有「失败」这个信号；所以这里只能区分
 * 正在跑和已结束，不去猜第三种。
 */
function fishStateOf(list, sessionId) {
  return isRunning(list, sessionId) ? 'running' : 'done'
}

/** 把一棵子代理树折成扁平的渲染列表（深度优先，带层级）。 */
function flattenTree(list, sessionId, depth, out, seen) {
  if (depth > MAX_FISH_DEPTH || seen.has(sessionId)) return
  seen.add(sessionId)
  const entries = catalogEntriesOf(list, sessionId)
  for (const entry of entries) {
    if (entry === null || typeof entry !== 'object' || typeof entry.id !== 'string') continue
    out.push({
      id: entry.id,
      depth,
      label: labelOf(list, entry.id, entry.label),
      mode: entry.mode,
      state: fishStateOf(list, entry.id),
      createdAt: entry.createdAt,
    })
    flattenTree(list, entry.id, depth + 1, out, seen)
  }
}

/** 「3 分钟前」这类相对时间；超过一天就显示天数。 */
function relativeTime(epochMs) {
  if (typeof epochMs !== 'number' || !Number.isFinite(epochMs)) return undefined
  const seconds = Math.max(0, Math.round((Date.now() - epochMs) / 1000))
  if (seconds < 60) return `${seconds} 秒前`
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  return `${Math.round(hours / 24)} 天前`
}

/**
 * 一行子代理：小鱼 + 名字 + 状态。
 *
 * @param props.entry - flattenTree 产出的一行。
 * @param props.onJump - 点击时跳到该子代理的会话。
 */
function ShoalRow(props) {
  const { entry, onJump } = props
  const indent = 14 + entry.depth * 18
  return React.createElement(
    'button',
    {
      type: 'button',
      className: 'dsf-row',
      style: { paddingLeft: `${indent}px` },
      onClick: onJump === undefined ? undefined : () => onJump(entry.id),
      title: entry.label,
    },
    React.createElement(FishAvatar, {
      id: entry.id,
      size: entry.depth === 0 ? 26 : 22,
      state: entry.state,
    }),
    React.createElement(
      'span',
      { className: 'dsf-row-body' },
      React.createElement('span', { className: 'dsf-row-title' }, entry.label),
      React.createElement(
        'span',
        { className: 'dsf-row-sub' },
        entry.state === 'running' ? '运行中' : '已结束',
        relativeTime(entry.createdAt) === undefined ? '' : ` · ${relativeTime(entry.createdAt)}`,
      ),
    ),
  )
}

/**
 * 整页：主会话 + 它下面全部层级的子代理。
 *
 * @param props.ctx - better-sidebar 的客户端 ctx（用来读会话列表）。
 * @param props.scope - 当前标签页所属的会话范围。
 * @param props.onSubagentJump - better-sidebar 给的跳转回调。
 */
function ShoalTab(props) {
  const { ctx, scope, onSubagentJump, visible } = props
  const list = useSessionList(ctx.sessions)
  // 列表快照里没有「当前会话」这个字段，标签页的 scope 才是权威来源。
  const currentId = scope?.sessionId
  const rootId = currentId === undefined ? undefined : rootSessionOf(list, currentId)

  const rows = []
  if (rootId !== undefined) flattenTree(list, rootId, 0, rows, new Set())

  const runningCount = rows.filter((row) => row.state === 'running').length

  return React.createElement(
    'div',
    { className: 'dsf-page', 'data-visible': visible === false ? 'false' : 'true' },
    React.createElement(
      'div',
      { className: 'dsf-root' },
      React.createElement(FishAvatar, {
        id: rootId === undefined ? 'main' : rootId,
        size: 30,
        state: isRunning(list, rootId) ? 'running' : undefined,
      }),
      React.createElement(
        'span',
        { className: 'dsf-root-body' },
        React.createElement(
          'span',
          { className: 'dsf-root-title' },
          labelOf(list, rootId, undefined, '主会话'),
        ),
        React.createElement(
          'span',
          { className: 'dsf-root-sub' },
          rows.length === 0
            ? '还没有子代理'
            : `${rows.length} 个子代理${runningCount === 0 ? '' : ` · ${runningCount} 个在跑`}`,
        ),
      ),
    ),
    rows.length === 0
      ? React.createElement('p', { className: 'dsf-empty' }, '这个会话还没有派出过子代理。')
      : React.createElement(
          'div',
          { className: 'dsf-list' },
          rows.map((entry) => React.createElement(ShoalRow, {
            key: entry.id,
            entry,
            onJump: onSubagentJump,
          })),
        ),
  )
}
