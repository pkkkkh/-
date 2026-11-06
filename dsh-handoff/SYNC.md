# 改完记得构建并同步（重要）

这个插件是 **TypeScript 源码 + 编译产物** 的结构，运行时加载的不是 `src/`。

```
原始源码：C:\Users\kh006\.dsh\im\apps\dsh-bilibili\dsh-handoff\src
编译产物：C:\Users\kh006\.dsh\im\apps\dsh-bilibili\dsh-handoff\lib
运行时：  C:\Users\kh006\.dsh\profiles\desktop\node_modules\dsh-handoff
```

## 改代码的标准流程

pnpm 不在系统 PATH 里，用 DSH 自带的这个（11.28.5）：

```powershell
$node = "C:\Users\kh006\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\node\bin\node.exe"
$pnpm = "C:\Users\kh006\.dsh\dsh-runtimes\dsh-primary-runtime\dependencies\pnpm\bin\pnpm.mjs"
cd C:\Users\kh006\.dsh\im\apps\dsh-bilibili\dsh-handoff

& $node $pnpm install      # 首次，或 package.json 变了
& $node $pnpm build        # tsdown：src/*.ts → lib/index.js + lib/client.js
& $node $pnpm test         # vitest，13 个测试文件
& $node $pnpm typecheck    # 可选，改类型时跑
```

> 工作区目前**还没装依赖**（没有 `node_modules`），第一次要先跑 `install`。

## 同步到运行时

```powershell
$src = "C:\Users\kh006\.dsh\im\apps\dsh-bilibili\dsh-handoff"
$dst = "C:\Users\kh006\.dsh\profiles\desktop\node_modules\dsh-handoff"
Copy-Item "$src\lib\*" "$dst\lib" -Force
Copy-Item "$src\package.json","$src\cordis.patch.yml" $dst -Force
```

同步后**重启 DSH** 才会重新加载。

## 两个产物，别只同步一个

| 产物 | 内容 | 说明 |
|---|---|---|
| `lib/index.js` | Host 半边（Cordis 插件） | 服务端逻辑：生成文档、写文件、路由 |
| `lib/client.js` | Client 半边（浏览器） | 打包成 `window.__ModuleLoader__.load(...)` 形式，由 Web 端加载 |

只同步 `index.js` 而忘了 `client.js`，界面那半边会仍是旧版本。

## 快速自检

```powershell
pnpm check:install      # 检查装机目录是否完整
pnpm integration        # 端到端集成测试
```

## 说明

- 本目录是 [zhenbang1216/dsh-handoff](https://github.com/zhenbang1216/dsh-handoff) 的源码副本，MIT 协议。
- 与 `../dsh-bilibili` 不同：那个是纯 JS、改 `lib/*.js` 直接生效；这个必须走 `pnpm build`。
