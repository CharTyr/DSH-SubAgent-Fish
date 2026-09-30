<div align="center">

<img src="logo.gif" width="120" alt="DSH SubAgent Fish" />

# DSH SubAgent Fish

**给 DSH 的每个子代理一条会游动的小鱼**

同一条鱼由子代理的 ID 决定 —— 同一个子代理永远是同一条鱼，不同子代理自然分成不同的鱼形、颜色与花纹。

`PolyForm Noncommercial 1.0.0` · 非商业使用 · [LICENSE](LICENSE)

</div>

---

## 样图

<img width="1154" height="759" alt="image" src="https://github.com/user-attachments/assets/6d7f1f84-ab15-48ed-a3f9-d8e065f75683" />

## 安装

插件是一个普通的 DSH 组合包（bundle）。**装之前先确认两件事**：

- 有一个能跑的 DSH（下面以 `web` profile 为例）；
- 可选：装了 [dsh-better-sidebar](https://github.com/omdsh-dev/DSH-better-sidebar) 才会有
  「子代理 · 小鱼」那一页。**没装也能用**，只是少一页，右侧栏标签上的鱼照常出现。

### 直接从 GitHub 装（推荐）

```bash
dsh plugin --profile web add github:CharTyr/DSH-SubAgent-Fish
```

`lib/` 是构建产物，但已经提交进仓库，所以**不会触发构建、也不需要 npm install**，装完即用。

想固定在某个版本而不是跟着默认分支走，在仓库名后面加 `#` 加标签：

```bash
dsh plugin --profile web add github:CharTyr/DSH-SubAgent-Fish#v0.1.0
```

### 或者从本地克隆装

```bash
git clone https://github.com/CharTyr/DSH-SubAgent-Fish.git
cd DSH-SubAgent-Fish
dsh plugin --profile web add link:$PWD
```

### 如果被拒绝了

这不是你的问题：`pnpm` 在装的时候可能顺手把你 profile 里**别的**插件升到与当前 dsh 不兼容的版本，
DSH 的兼容检查就会拒绝整次安装并回滚。这种情况下手工加两处即可，完全不碰 pnpm：

1. 打开 `~/.dsh/profiles/web/package.json`，在 `dependencies` 里加一行
   （`github:` 或 `link:` 按你上面用的那种）：

   ```json
   "dsh-subagent-fish": "github:CharTyr/DSH-SubAgent-Fish"
   ```

2. 同一个文件的 `dsh.profile.bundles` 数组**末尾**追加一项：

   ```json
   "dsh-subagent-fish"
   ```

   > 必须在 `dsh-better-sidebar` **之后** —— 本插件要向它注册页面，得先有它。

3. 在 profile 目录里装上去：

   ```bash
   cd ~/.dsh/profiles/web
   pnpm install
   ```

### 确认挂上了（可选）

```bash
dsh --profile web --dump-config | grep -A1 subagent-fish
```

应该看到：

```yaml
- id: subagent-fish
  name: dsh-subagent-fish
```

同时确认输出里**没有** `skipped bundle`。

### 重启

```bash
# 先停掉正在跑的 dsh web，再重新启动
dsh web
```

插件在启动时组合进插件树，所以**必须重启**才会加载。

### 核对

重启后应该看到：

- 打开任意一个子代理对话，右侧栏的标签上出现该子代理的小鱼；
- better-sidebar 侧边栏里多出一页「子代理 · 小鱼」（＋ 菜单里也在）；
- 同一个子代理反复进出，鱼始终是同一条；不同子代理是不同的鱼。

还想更确定一点，可以对着 `dsh web` 启动时打印的那个 URL 跑一次自检：

```bash
node tools/verify-live.mjs 'http://127.0.0.1:3080/?token=…'
```

它会兑换 cookie、读回服务端**真正组合出来的**客户端模块图，核对本插件的 bundle 确实被送到浏览器。

### 卸载

```bash
dsh plugin --profile web remove dsh-subagent-fish
```

手工加的话，把上面加的两处删掉，重启即可。

## 它做什么

只做两处，都是「加」而不是「换」：

| | 位置 | 做法 |
|---|---|---|
| **D** | 右侧栏的子代理对话标签 | 替换该标签**标题**的画法（`sidebar.right.pane.tab.title`）。子代理对话的类型没有占用这个位置，所以标签上写什么由本插件决定，而标签正文一个字都不碰。 |
| **E** | `dsh-better-sidebar` 的子代理树页面 | 用它的公开接口 `ctx.betterSidebar.registerTab()` 注册**独立的一页**。它原本的子代理页、DSH 自己的一切都原样保留。没装 better-sidebar 时这一页自然消失，D 不受影响。 |

整条插件**没有主机侧逻辑**：鱼的身份是子代理 id 的纯函数，数据本来就在客户端。

## 开发

```bash
node tools/sync-engine.mjs      # 从上游画鱼源码重新生成 src/fish/engine.js
node tools/sync-engine.mjs --check
node tools/build-client.mjs     # 生成 lib/client.js 与 lib/index.js
node tools/test-client.mjs      # 对已构建的 lib/client.js 跑 43 项检查
node tools/build-logo.mjs       # 生成 logo.svg / logo.png / logo.gif
node tools/render-preview.mjs   # 把插件真实输出渲染成一个本地 HTML
node preview/build.mjs          # 生成离线预览页（本地用，不发布）
```

`src/fish/engine.js` 是**生成文件**，由 `tools/sync-engine.mjs` 从
[MaiWork](https://github.com/CharTyr/MaiWork) 的正式画鱼源码加上「花纹」与「暂停」两项能力后生成，
和控制台里正式用的鱼是同一份代码。上游一改，生成脚本会直接报错，而不是悄悄产出走样的版本。

`logo.svg` / `logo.png` / `logo.gif` 同样是生成的：用的就是插件里同一个 `fishSvg()`。
SVG 里烘焙了 SMIL 动画，GIF 是同一批帧的栅格版 —— README 顶部用的是 GIF，
因为 GitHub 不会播放仓库里 SVG 自带的动画。

## 状态

- 离线能验的都验了：43 项检查全绿，插件真实输出已渲染核对。
- **真实界面尚未核验**：需要重启 `dsh web` 才会加载。

## 许可

**[PolyForm Noncommercial License 1.0.0](LICENSE)**

`preview/dsh-theme.css` 是从 DSH 自己的主题包里原样提取的，而 DSH 以 **MIT** 发布。该文件仍按 MIT 分发，**不受本仓库协议约束**

## Friendly Links
[LINUX DO](https://linux.do/)
