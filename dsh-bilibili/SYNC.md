# 改完记得同步（重要）

这个目录是 **源码副本**，运行时真正加载的不是它，而是：

```
运行时：C:\Users\kh006\.dsh\profiles\desktop\node_modules\dsh-bilibili\lib
源码：  C:\Users\kh006\.dsh\im\apps\dsh-bilibili\dsh-bilibili\lib
```

两份文件里，`envcheck.js` / `login.js` / `index.js` 是硬链接（改一份等于改两份）；
**`digest.js` / `channel.js` / `format.js` / `ads.js` / `keyframes.js` / `extractor.js` 是各自独立的副本**，
改完必须手动同步，否则 DSH 跑的还是旧代码。

## 同步

```powershell
$src = "C:\Users\kh006\.dsh\im\apps\dsh-bilibili\dsh-bilibili\lib"
$dst = "C:\Users\kh006\.dsh\profiles\desktop\node_modules\dsh-bilibili\lib"
Copy-Item "$src\digest.js","$src\channel.js","$src\format.js","$src\ads.js","$src\keyframes.js","$src\extractor.js" $dst -Force
```

同步后需要重启 DSH 才会重新加载模块。

## 校验

```powershell
& "D:\DSH\resources\runtime\primary-runtime\dependencies\node\bin\node.exe" `
  "C:\Users\kh006\.dsh\im\scripts\check-bilibili.mjs"
```

会做两件事：比对两份文件是否一致（不一致直接报红）、跑 digest/channel 的功能用例。退出码 0 = 通过。

## 单元测试（58 项）

工作区没有装依赖（`login.js` 依赖 `qrcode`），所以**测试只能在装机目录跑**：

```powershell
$P = "C:\Users\kh006\.dsh\profiles\desktop\node_modules\dsh-bilibili"
Copy-Item "C:\Users\kh006\.dsh\im\apps\dsh-bilibili\dsh-bilibili\test" "$P\test" -Recurse -Force
& "D:\DSH\resources\runtime\primary-runtime\dependencies\node\bin\node.exe" --test --test-reporter=dot   # 在 $P 下执行
Remove-Item "$P\test" -Recurse -Force
```

## 可调环境变量

| 变量 | 默认 | 作用 |
|---|---|---|
| `DSH_BILIBILI_FRAME_CONCURRENCY` | 3 | 抓帧并发（1–8） |
| `DSH_BILIBILI_VISION_CONCURRENCY` | 2 | 视觉描述并发（1–4） |
| `DSH_BILIBILI_CACHE_TTL_HOURS` | 72 | `%TEMP%\dsh-bilibili\BV*` 保留时长，0=不按时间清 |
| `DSH_BILIBILI_CACHE_MAX_MB` | 2048 | 该目录总容量上限，0=不按容量清 |
| `DSH_BILIBILI_DIGEST` / `_RATIO` / `DSH_BILIBILI_CHANNEL` | — | 关闭骨架 / 调整压缩比 / 关闭通道探针 |
| `DSH_BILIBILI_ADS` | 开 | 置 0 关闭商单识别与折叠 |
| `cross_check`（工具参数）/ `crossCheckAsr`（配置） | 关 | 第二路 ASR（必剪）交叉校验，约多花 10–60 秒 |

## 回滚

改动前的原版备份在运行时目录里：`node_modules\dsh-bilibili\lib.bak-20261105\`
（注意：**不在**本工作区，交接文档里写的位置有歧义）。
