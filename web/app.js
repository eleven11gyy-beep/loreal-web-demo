const scenarios = {
  lip: {
    cameraTitle: "口红边界识别",
    cameraStatus: "采集中",
    feedbackMode: "纠偏中",
    senseText: "摄像头识别人脸、唇部和当前口红位置。",
    intentText: "用户正在进行口红涂抹，需要起始点和边界提醒。",
    planText: "比较目标位置与当前动作，生成方向建议。",
    resultText: "输出语音提醒和腕带震动指令。",
    steps: [
      {
        status: "设备唤醒",
        agent: "任务规划中",
        mode: "准备中",
        voice: "我看到你坐好了，口红也在画面里。我们先从下唇中部开始。",
        command: "UP",
        motor: "up",
        haptic: "上方马达 45%",
        x: 42,
        y: -72,
        dot: { left: "45%", top: "75%" },
        face: "96%",
        landmark: "91%",
        pose: "良好",
        completion: "18%",
        duration: "00:18",
        error: "34px",
        latency: "210ms",
      },
      {
        status: "识别唇部",
        agent: "下手点判断",
        mode: "引导中",
        voice: "下手点还偏低一点，腕带上方会轻震，手稍微往上抬。",
        command: "UP",
        motor: "up",
        haptic: "上方马达 60%",
        x: 22,
        y: -48,
        dot: { left: "47%", top: "72%" },
        face: "98%",
        landmark: "94%",
        pose: "稳定",
        completion: "36%",
        duration: "00:46",
        error: "22px",
        latency: "196ms",
      },
      {
        status: "实时检测",
        agent: "误差计算",
        mode: "纠偏中",
        voice: "接下来要往左边多涂一点哦，左侧震动会提醒你。",
        command: "LEFT",
        motor: "left",
        haptic: "左侧马达 70%",
        x: 80,
        y: -18,
        dot: { left: "42%", top: "69%" },
        face: "98%",
        landmark: "95%",
        pose: "良好",
        completion: "58%",
        duration: "01:26",
        error: "16px",
        latency: "184ms",
      },
      {
        status: "继续涂抹",
        agent: "方案修正",
        mode: "收敛中",
        voice: "很好，现在位置接近目标。动作放慢一点，保持这一条边界。",
        command: "RIGHT",
        motor: "right",
        haptic: "右侧马达 38%",
        x: -18,
        y: 10,
        dot: { left: "52%", top: "67%" },
        face: "99%",
        landmark: "96%",
        pose: "稳定",
        completion: "74%",
        duration: "02:02",
        error: "10px",
        latency: "178ms",
      },
      {
        status: "妆容质检",
        agent: "完成判断",
        mode: "检查中",
        voice: "我正在检查边界和对称性。右侧嘴角还有一点点没有覆盖。",
        command: "RIGHT",
        motor: "right",
        haptic: "右侧马达 42%",
        x: -28,
        y: 4,
        dot: { left: "54%", top: "68%" },
        face: "99%",
        landmark: "97%",
        pose: "稳定",
        completion: "88%",
        duration: "02:34",
        error: "7px",
        latency: "172ms",
      },
      {
        status: "完成",
        agent: "夸夸陪伴",
        mode: "已完成",
        voice: "完成啦，唇线很干净，颜色覆盖也均匀。今天这个气色很好。",
        command: "COMPLETE",
        motor: "complete",
        haptic: "全部轻震 2 次",
        x: 0,
        y: 0,
        dot: { left: "50%", top: "68%" },
        face: "99%",
        landmark: "97%",
        pose: "完成",
        completion: "96%",
        duration: "02:48",
        error: "4px",
        latency: "168ms",
      },
    ],
  },
  contour: {
    cameraTitle: "骨相修容定位",
    cameraStatus: "分析脸型",
    feedbackMode: "路线提示",
    senseText: "识别颧骨、下颌线和面部阴影区域。",
    intentText: "用户正在做修容，需要知道刷子是否落在目标骨相线上。",
    planText: "根据脸部关键点生成修容路线和力度提醒。",
    resultText: "用语音提示刷向，并用腕带反馈偏离方向。",
  },
  base: {
    cameraTitle: "粉底均匀度质检",
    cameraStatus: "检测色块",
    feedbackMode: "补涂提醒",
    senseText: "识别面部覆盖区域、色差和卡粉风险。",
    intentText: "用户需要确认粉底是否均匀，尤其是鼻翼与下颌边界。",
    planText: "计算未覆盖区域和明显色块，给出补涂优先级。",
    resultText: "输出局部补涂提醒，避免重复涂抹造成厚重。",
  },
  eye: {
    cameraTitle: "眼影范围辅助",
    cameraStatus: "识别眼部",
    feedbackMode: "范围提示",
    senseText: "识别眼窝、眼尾和眼影晕染边界。",
    intentText: "用户正在画眼影，需要避免左右不对称和超出范围。",
    planText: "比较两侧眼影范围，判断是否需要补色或停止。",
    resultText: "语音提示晕染方向，腕带提示眼尾或上眼窝偏差。",
  },
};

const scenarioHints = {
  contour: "刷子还没有落到颧骨下方，向下方轻扫一厘米。",
  base: "鼻翼附近粉底覆盖偏薄，建议少量点涂再拍开。",
  eye: "左眼尾颜色范围略大，先停手，换右眼做同样宽度。",
};

let currentScenario = "lip";
let currentStep = 0;
let timer = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

function setText(id, value) {
  const node = $(id);
  if (node) node.textContent = value;
}

function activateList(selector, activeIndex, activeClass = "is-active") {
  $$(selector).forEach((node, index) => {
    node.classList.toggle(activeClass, index === activeIndex);
  });
}

function setMotor(command, motor) {
  $$(".motor").forEach((node) => node.classList.remove("is-active"));
  if (motor === "complete") {
    $$(".motor").forEach((node) => node.classList.add("is-active"));
    return;
  }
  const active = $(`.motor[data-motor="${motor}"]`);
  if (active) active.classList.add("is-active");
}

function renderStep(index) {
  const data = scenarios.lip.steps[index];
  currentStep = index;

  setText("#cameraStatus", data.status);
  setText("#agentStatus", data.agent);
  setText("#feedbackMode", data.mode);
  setText("#voiceText", data.voice);
  setText("#bandCommand", data.command);
  setText("#bandHint", data.haptic.replace("马达", "震动"));
  setText("#hapticPulse", data.haptic);
  setText("#xError", data.x > 0 ? `+${data.x}` : `${data.x}`);
  setText("#yError", data.y > 0 ? `+${data.y}` : `${data.y}`);
  setText("#faceConfidence", data.face);
  setText("#landmarkConfidence", data.landmark);
  setText("#poseStatus", data.pose);
  setText("#completionRate", data.completion);
  setText("#durationMetric", data.duration);
  setText("#errorMetric", data.error);
  setText("#latencyMetric", data.latency);

  const dot = $("#currentDot");
  dot.style.left = data.dot.left;
  dot.style.top = data.dot.top;

  setMotor(data.command, data.motor);
  activateList(".flow-card", index);
  activateList(".agent-chain li", Math.min(index, 3), "is-current");
  activateList(".journey-step", Math.min(Math.floor(index / 1.5), 3));
}

function renderScenario(name) {
  currentScenario = name;
  const scenario = scenarios[name];
  $$(".scenario-tab").forEach((tab) => {
    tab.classList.toggle("is-selected", tab.dataset.scenario === name);
  });

  setText("#cameraTitle", scenario.cameraTitle);
  setText("#cameraStatus", scenario.cameraStatus);
  setText("#feedbackMode", scenario.feedbackMode);
  setText("#senseText", scenario.senseText);
  setText("#intentText", scenario.intentText);
  setText("#planText", scenario.planText);
  setText("#resultText", scenario.resultText);

  if (name === "lip") {
    renderStep(currentStep);
  } else {
    setText("#voiceText", scenarioHints[name]);
    setText("#agentStatus", "方案演示");
    setText("#bandCommand", name === "base" ? "COMPLETE" : "DOWN");
    setText("#bandHint", name === "base" ? "全部轻震 1 次" : "下方震动 260ms");
    setText("#hapticPulse", name === "base" ? "全部轻震反馈" : "下方马达 55%");
    setText("#xError", name === "eye" ? "-22" : "+12");
    setText("#yError", name === "contour" ? "-36" : "+8");
    setText("#faceConfidence", "97%");
    setText("#landmarkConfidence", name === "base" ? "89%" : "93%");
    setText("#poseStatus", "稳定");
    setMotor(name === "base" ? "COMPLETE" : "DOWN", name === "base" ? "complete" : "down");
    $("#currentDot").style.left = name === "eye" ? "58%" : "48%";
    $("#currentDot").style.top = name === "contour" ? "59%" : "64%";
    activateList(".agent-chain li", 2, "is-current");
  }
}

function nextStep() {
  renderScenario("lip");
  renderStep((currentStep + 1) % scenarios.lip.steps.length);
}

function resetDemo() {
  stopAutoRun();
  currentStep = 0;
  renderScenario("lip");
  renderStep(0);
}

function stopAutoRun() {
  if (timer) {
    clearInterval(timer);
    timer = null;
    setText("#autoRun", "Auto play");
  }
}

function toggleAutoRun() {
  if (timer) {
    stopAutoRun();
    return;
  }
  renderScenario("lip");
  setText("#autoRun", "Pause");
  timer = setInterval(() => {
    renderStep((currentStep + 1) % scenarios.lip.steps.length);
  }, 1400);
}

$("#nextStep").addEventListener("click", nextStep);
$("#autoRun").addEventListener("click", toggleAutoRun);
$("#resetTop").addEventListener("click", resetDemo);

$$(".scenario-tab").forEach((tab) => {
  tab.addEventListener("click", () => {
    stopAutoRun();
    renderScenario(tab.dataset.scenario);
  });
});

$$(".micro-actions button").forEach((button) => {
  button.addEventListener("click", () => {
    stopAutoRun();
    renderScenario("lip");
    const command = button.dataset.command;
    const stepIndex = command === "LEFT" ? 2 : command === "RIGHT" ? 3 : 5;
    renderStep(stepIndex);
  });
});

renderStep(0);
