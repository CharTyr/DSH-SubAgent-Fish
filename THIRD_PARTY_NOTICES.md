# 第三方声明

本仓库整体按 **PolyForm Noncommercial License 1.0.0** 分发（见 [LICENSE](LICENSE)）。
下面这份材料来自第三方，**不适用**本仓库的协议，仍按它原本的协议分发。

---

## `preview/dsh-theme.css`

从 DeepSeek Harness（DSH）自己的主题包里原样提取的设计变量，只为让离线预览页和真实界面
同色，不参与插件构建。DSH 以 MIT 许可发布，MIT 允许再分发，但要求保留原有的版权与许可声明。

```
MIT License

Copyright (c) 2026 DeepSeek

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

该文件是 DSH 的 `@deepseek-ai/dsh-client-ui-theme` 包内联样式的摘录，**没有任何改动**。

---

本插件通过公开接口与 DSH、`dsh-better-sidebar` 协作，但**不包含**它们的任何代码。
DSH 与本插件的关系是「插件与宿主」，不是代码复用。
