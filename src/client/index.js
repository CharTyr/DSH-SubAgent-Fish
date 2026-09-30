// ---------------------------------------------------------------------------
// 插件浏览器侧入口。
//
// 只做两件事，都是「加」而不是「换」：
//
//   D · 右侧栏的子代理对话标签上画该子代理的小鱼
//       （sidebar.right.pane.tab.title，按标签类型分发；DSH 自己没占这个位置）
//   E · 在 dsh-better-sidebar 里注册一整页「子代理 · 小鱼」
//       （用它的公开接口 ctx.betterSidebar.registerTab；没装则该页自然消失）
//
// 没有主机侧逻辑：鱼的身份是子代理 id 的纯函数，数据也都在客户端已有的会话列表里。
//
// 本文件由 tools/build-client.mjs 拼进 lib/client.js。
// ---------------------------------------------------------------------------

/** 这条插件用到的客户端服务。只用 slots；betterSidebar 是可选依赖，单独探测。 */
const inject = ['slots']

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

/** 标签页图标：一小条会游的鱼，尺寸由调用方给。 */
const tabIconCache = new Map()
function shoalTabIcon(size) {
  let markup = tabIconCache.get(size)
  if (markup === undefined) {
    const identity = fishIdentity('dsh-subagent-fish#tab')
    markup = fishSvg(identity.seed, {
      size,
      pattern: identity.pattern,
      patternSeed: identity.patternSeed,
      strength: identity.strength,
    })
    tabIconCache.set(size, markup)
  }
  return React.createElement('span', {
    className: 'dsf-avatar',
    style: { '--dsf-size': `${size}px` },
    dangerouslySetInnerHTML: { __html: markup },
  })
}

/**
 * 装 E：better-sidebar 里的整页子代理树。
 *
 * 用 ctx.inject 等 betterSidebar 服务出现再注册——better-sidebar 没装时这段
 * 永远不执行，D 照常工作，其余功能一点不受影响。
 *
 * @param ctx - 客户端 cordis 上下文。
 */
function registerBetterSidebarPage(ctx) {
  ctx.inject(['betterSidebar'], (scope) => {
    scope.effect(() => scope.betterSidebar.registerTab({
      id: BETTER_TAB_ID,
      title: () => '子代理 · 小鱼',
      description: () => '用会游的小鱼看当前会话树上的全部子代理。',
      icon: (size) => shoalTabIcon(size),
      order: 40,
      single: true,
      component: (props) => React.createElement(ShoalTab, props),
    }), 'subagent-fish: better sidebar page')
  })
}

/**
 * 插件主体：装样式，然后挂上 D 与 E。
 * @param ctx - 客户端 cordis 上下文。
 */
function apply(ctx) {
  installFishCss()
  registerSubagentTabTitles(ctx)
  registerBetterSidebarPage(ctx)
}
