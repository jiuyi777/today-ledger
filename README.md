# 今日小账

今日小账是一款独立的记账 App 原型，核心目标是把“记一笔账”做得足够轻、快、清楚：打开之后选择支出、收入或转账，点分类，输入金额，必要时补一句备注，记录会自动进入明细和统计。

它不是聊天软件，角色功能是记账后的附加体验：用户可以导入角色卡，设置角色偏好、世界书和评账 Prompt。每次记账完成后，已启用并接入 API 的角色会自动给出一句短评，短评只基于真实账目内容，不虚构额外情节。

## 主要功能

- 快速记账：支出、收入、转账三类账目，支持金额、分类和备注。
- 明细统计：支持当天、本周、当月、当年和总计视角。
- 图表查看：明细页内提供列表、饼图和条形图，不把时间范围和图表类型混在一起。
- 分类管理：默认包含餐饮、交通、游戏、礼物、购物、居住、医疗、学习生活等分类，也可以新增、删除和自定义图标。
- 角色通讯录：像通讯录一样导入和管理角色卡，可启用多个角色参与评账。
- 世界书和 Prompt：支持导入或手动创建世界书条目，也可以直接查看和修改全局评账 Prompt。
- API 接入：支持填写 OpenAI 兼容接口地址和 API Key，并通过模型拉取选择模型。
- 主题风格：保留小手机方向的主题入口，目前包含奶油手绘、古风手札、状态终端、阿尔切利斯像素。

## 本地运行

这个项目是静态前端加 Capacitor Android 工程。网页原型可以直接用本地静态服务器打开：

```powershell
npx serve . -l 3011
```

然后访问：

```text
http://127.0.0.1:3011/
```

## 测试

```powershell
node tests\architecture.test.mjs
node tests\ledger-core.test.mjs
node --check src\app\main.mjs
node --check src\domain\ledger-core.mjs
```

## 打包 APK

需要 Node.js、Android SDK 和 JDK 21。

```powershell
npm install
npm run build:apk
```

当前已导出的 debug APK：

```text
dist-apk\today-ledger-debug.apk
```

## 说明

这是早期可安装原型，优先验证记账流程、手机界面、角色评账和 API 接入。后续可以继续补正式图标、签名 release 包、数据导出、云同步和更完整的角色预设管理。
