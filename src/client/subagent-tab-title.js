// ---------------------------------------------------------------------------
// D · 右侧栏的子代理标签
//
// DSH 把「每个标签的标题画什么」单独开了一个按类型分发的插槽
// （`sidebar.right.pane.tab.title`，keyed）。子代理对话的标签类型是
// `@deepseek-ai/dsh-client-ui-subagent`，而它自己**没有**占用这个插槽——
// 所以标签上写什么是我们说了算，而标签正文（真正的对话内容）一点都不用碰。
//
// 标签的地址形如 dsh-resource://subagentchat/session/<子会话 id>，
// 这个 id 就是那条鱼的身份来源：同一个子代理的标签，鱼永远是同一条。
//
// 本文件由 tools/build-client.mjs 拼进 lib/client.js，共用同一个作用域。
// ---------------------------------------------------------------------------

/** 子代理对话标签的类型 id（= dsh-client-ui-subagent 的注册 id）。 */
const SUBAGENT_CHAT_TAB_ID = '@deepseek-ai/dsh-client-ui-subagent'
/** 子代理对话地址的前缀；后半段就是子会话 id。 */
const SUBAGENT_CHAT_PREFIX = 'dsh-resource://subagentchat/session/'

/**
 * 从标签地址里取出子会话 id。
 * @param address - 标签的 contentId。
 * @returns 子会话 id；地址不是子代理对话时返回 undefined。
 */
function subagentSessionIdOf(address) {
  if (typeof address !== 'string' || !address.startsWith(SUBAGENT_CHAT_PREFIX)) return undefined
  const id = address.slice(SUBAGENT_CHAT_PREFIX.length)
  return id.length === 0 ? undefined : decodeURIComponent(id)
}

/**
 * 子代理标签的标题：小鱼 + 原来的名字。
 *
 * 地址不是子代理对话时原样返回标题 —— 这样即使 DSH 以后改了地址格式，
 * 最坏也只是没有鱼，不会把标签弄坏。
 */
function SubagentFishTabTitle(props) {
  const { useTabInfo, useSessionStatus } = props
  const info = useTabInfo()
  const tab = info.tab
  const childId = subagentSessionIdOf(tab.contentId)
  // 这个 hook 必须**无条件**调用：只有「prop 在不在」是稳定的，
  // 拿 childId 去决定调不调，会让同一个组件在两次渲染里 hook 数量不同。
  const hasStatus = typeof useSessionStatus === 'function'
  const running = hasStatus
    ? useSessionStatus((statuses) => childId !== undefined && statuses?.get?.(childId)?.running === true)
    : undefined
  if (childId === undefined) return tab.title
  return React.createElement(
    'span',
    { className: 'dsf-chip' },
    React.createElement(FishAvatar, { id: childId, size: 16, state: running === true ? 'running' : undefined }),
    React.createElement('span', { className: 'dsf-label' }, tab.title),
  )
}
