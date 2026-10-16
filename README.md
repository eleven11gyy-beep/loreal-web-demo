# MODIASSIST Web Demo

口红实时方向引导与中文语音的网页体验入口，无需安装 Python。

**在线体验：https://eleven11gyy-beep.github.io/loreal-web-demo/**

## 使用

1. 在系统浏览器打开上方 HTTPS 网址，点击「开始实时体验 · 摄像头 + 语音」。
2. 点击「测试语音」，检查设备音量与中文音色。
3. 点击 **Start Camera** 并允许摄像头；首次加载模型可能需要等待。
4. 画面中保留一张人脸，将红色或粉色口红放在嘴唇附近。可通过 **Calibrate color** 点击口红取色，或用 **Mouse tip** 模拟追踪点。
5. 镜像画面的左右方向请先用小幅移动确认；按 **Stop** 结束。切到后台也会停止，返回后需要重新开始。

方向稳定约 250 毫秒后播报，同方向持续有效时每 5 秒重复；失去人脸或口红后取消旧移动提示。

首页流程和指标是概念演示，实时功能目前聚焦口红位置引导。实体腕带尚未接入。
识别效果受光照、背景和口红颜色影响，中文语音效果取决于设备。摄像头画面在当前浏览器中处理，不上传到 Python 服务；系统音色可能需要联网。

## 仓库范围

本公开仓库包含网页、浏览器运行必需的视觉/语音 JavaScript、MediaPipe 模型与 WASM，以及网页测试和部署配置。
这些客户端文件可被访问者下载、查看。Python 服务、本地运行模块及其代码历史保留在团队私有仓库。

## 本地预览和检查

```bash
python3 -m http.server 8000 --directory web
# 打开 http://localhost:8000/
node --test tests/web/*.test.mjs
```

测试需要 Node.js 24，无需安装 npm 依赖。实际摄像头、手机兼容性、中文音色和截图下载仍需真实设备验收。

## 部署

GitHub Pages 使用 GitHub Actions，工作流仅发布 `web/`。
更新 `main` / `master` 分支中的网页、网页测试或工作流后自动部署，也可手动运行 **Deploy browser demo to GitHub Pages**。
公开仓库为独立的发布副本，私有仓库更新不会自动同步到这里；发布前需同步对应网页改动并验证。
