# pkkkkh 的项目仓库

这个仓库按「一个子目录 = 一个项目」的方式组织。

## dsh-bilibili

DeepSeek Harness（DSH）的 B 站视频分析插件：取文稿、抽帧、环境体检、扫码登录，
并提供文稿骨架压缩、文字通道判定、双字幕轨 / 第二路 ASR 交叉校验、商单折叠。

- 目录：[`dsh-bilibili/`](dsh-bilibili/)
- 说明：[`dsh-bilibili/README.md`](dsh-bilibili/README.md)
- 版本：0.8.0
- 协议：MIT

派生自 [CZX2244/dsh-bilibili](https://github.com/CZX2244/dsh-bilibili)，
本仓库是个人修改版，增加了文稿骨架、通道探针、交叉校验与商单识别等模块。

## 安装到 DSH

把 `dsh-bilibili/` 整个目录放到 DSH 的插件目录（Windows 下通常是
`C:\Users\<你>\.dsh\profiles\desktop\node_modules\dsh-bilibili`），然后重启 DSH。

注意：`lib/` 里的模块改动需要**手动同步**到运行时目录才会生效，
细节见 `dsh-bilibili/SYNC.md`。
