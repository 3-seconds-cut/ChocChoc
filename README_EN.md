<div align="center">

# 💧 ChocChoc
### *Blink. Breathe. Done.*

**Keeping your eyes moist in front of the monitor**

<img width="250" height="250" alt="chocchoc" src="https://github.com/user-attachments/assets/6a7b9c27-f36a-4564-a57c-dbdf761952fe" />

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey)
![Built with](https://img.shields.io/badge/built%20with-❤️-red)

</div>

**[한국어](README.md)**/**English** (Current page)

---

## 🎯 Project Overview

We protect your health in front of the monitor in a fun way.

- Real-time eye blink detection for dry eye alerts
- Gamification with combo, fever, and life systems
- Personalized AI reports based on eye blink data

## 📱 Screenshots
<img src="https://github.com/user-attachments/assets/3b7e6c8f-c66a-4b27-85e1-0cd6fe792139" width="300" />

---

## 🚀 Quick Start

### 📋 System Requirements
- **macOS** 10.14+ or **Windows** 10+
- **Node.js** 18+
- **Python** 3.8+
- **Webcam** (built-in or external)

### 🔧 Installation
```bash
# 1. Clone repository
git clone https://github.com/Ssuamje/ChocChoc.git
cd ChocChoc

# 2. Client setup
cd client/choc-app
npm install
npm run build

# 3. Server setup
cd ../../server
pip install -r requirements.txt

# 4. Environment variables (optional)
export OPENAI_API_KEY="your-api-key-here"

# 5. Run
npm run dev:electron  # Client
python main.py        # Server (separate terminal)
```

---

## ✨ Key Features
> The project is in early stage, so some features may be unstable!

### 👁️ Real-time Eye Blink Recognition
- **MediaPipe FaceMesh** based precise tracking
- **EAR(Eye Aspect Ratio)** algorithm for accurate detection
- **Personal calibration** for optimized threshold settings

### 🎮 Gamification
```
💖 Heart System      Hearts decrease when not blinking for long periods
🔥 Combo System      Build combos with consecutive blinks
⭐ Fever Mode        Special bonus when combo achieved
🎯 Real-time Feedback    Immediate response based on eye status
```

### 🤖 AI Health Analysis
- **Personalized daily reports** generation
- **Blink pattern analysis** and visualization
- **Customized health advice** provision
- **Long-term trend tracking**

### 🖥️ UX/UI Designed for Developer Work Environment
- **Adaptive transparency**: Adjust as desired based on work focus
- **Cross-platform**: Simultaneous support for macOS and Windows
- **Less intrusive notifications**: Designed not to interrupt work flow

### 🔄 Data Flow
1. **Real-time detection**: MediaPipe extracts facial landmarks from webcam
2. **Analysis processing**: EAR algorithm determines blink state
3. **Game logic**: Converts blink events into game elements
4. **Data collection**: Sends session data to server
5. **AI analysis**: Generates personalized health reports using OpenAI API
6. **Visualization**: Provides insights through graphs and charts

---

### 🗺️ Roadmap
- [ ] **v2.0**: Add eye stretching / Improve eye recognition algorithm / Advanced report server
---

## 👥 Team

| Role | Name | Area | GitHub |
|------|------|------|---------|
| 🎯 Lead | Sangje | Project lead, planning, architecture | [@Ssuamje](https://github.com/Ssuamje) |
| 🖥️ Frontend | Inho | Electron, React UI | [@42inshin](https://github.com/42inshin) |
| 🤖 AI/CV | Yeonjin | MediaPipe, algorithms | [@ye0njinkim](https://github.com/ye0njinkim) |
| 🐍 AI/Backend | Jeonggyun | FastAPI, data analysis | [@Park323](https://github.com/Park323) |
| 👓 AI/Research | Jihyun | MediaPipe, UX, research | [@Jihyun0510](https://github.com/Jihyun0510) |

---

## 📄 License

This project is distributed under the [MIT License](LICENSE).

```
MIT License - Free to use, modify, and distribute
Commercial use allowed | Modification allowed | Distribution allowed | Private use allowed
```

</div>