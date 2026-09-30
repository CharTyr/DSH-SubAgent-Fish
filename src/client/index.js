// ---------------------------------------------------------------------------
// 插件浏览器侧入口。
//
// 只做两件事，都是「加」而不是「换」：
//
//   D · 右侧栏的子代理对话标签上画该子代理的小鱼
//       （sidebar.right.pane.tab.title，按标签类型分发；DSH 自己没占这个位置）
//   E · 往 dsh-better-sidebar「任务管理」页已有的子代理行上挂小鱼
//       （它没留行级扩展口，同 id 接管又会抛错，所以只能在渲染出来的行上挂 ——
//         详见 better-sidebar-rows.js 的说明）
//
// 没有主机侧逻辑：鱼的身份是子代理 id 的纯函数，数据也都在客户端已有的会话列表里。
//
// 本文件由 tools/build-client.mjs 拼进 lib/client.js。
// ---------------------------------------------------------------------------

/** 这条插件用到的客户端服务。betterSidebar 是可选依赖，单独探测。 */
const inject = ['slots', 'sessions']

/**
 * 装 D：子代理对话标签的小鱼。
 * @param ctx - 客户端 cordis 上下文。
 */
function registerSubagentTabTitles(ctx) {
  ctx.effect(
    () => ctx.slots.inject('sidebar.right.pane.tab.title', () => ctx.slots.register({
      name: 'sidebar.right.pane.tab.title',
      key: SUBAGENT_CHAT_TAB_ID,
    }, SubagentFishTabTitle)),
    'subagent-fish: subagent chat tab titles',
  )
}

/**
 * 装 E：往 better-sidebar 的子代理行上挂鱼。
 *
 * 用 ctx.inject 等 betterSidebar 服务出现再动手——没装 better-sidebar 时这段
 * 永远不执行，D 照常工作，其余功能一点不受影响。
 *
 * @param ctx - 客户端 cordis 上下文。
 */
function registerSidebarRows(ctx) {
  ctx.inject(['betterSidebar'], (scope) => {
    scope.effect(() => installSidebarRowFish(scope), 'subagent-fish: sidebar subagent rows')
  })
}

/**
 * 插件主体：装样式，然后挂上 D 与 E。
 * @param ctx - 客户端 cordis 上下文。
 */
function apply(ctx) {
  installFishCss()
  registerSubagentTabTitles(ctx)
  registerSidebarRows(ctx)
}
