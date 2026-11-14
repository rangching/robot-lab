/**
 * ESP32 DevKit V1 的任務程式與自由建構程式。
 * 寫法同 programs.ts：顯示用的 Arduino 程式碼＋對應的 JS 行為模擬；⟦tag⟧ 是高亮標記，{{key}} 是可調參數。
 * 模擬器的 analogRead() 回傳 0–1023（滿刻度＝板子的邏輯電壓），這裡換算成 ESP32 的 12 位元 0–4095。
 */
import type { IO, ProgramDef } from './programs';
import { useWeb } from './web';

const to12bit = (v: number) => Math.round((v * 4095) / 1023);

export const P_ESP_BLINK: ProgramDef = {
  id: 'esp-blink',
  title: '板上藍燈閃爍（GPIO2）',
  outputs: ['D2'],
  params: [{ key: 'ms', label: '等待毫秒', def: 500, min: 50, max: 3000 }],
  code: `// DevKit V1 的板上藍燈接在 GPIO2（不是 Arduino 習慣的 13）
const int LED = 2;

void setup() {
  pinMode(LED, OUTPUT);             // 設成輸出 ⟦s1⟧
  Serial.begin(115200);             // ESP32 慣用 115200 ⟦s2⟧
}

void loop() {
  digitalWrite(LED, HIGH);          // 3.3 V：燈亮 ⟦on⟧
  Serial.println("亮"); ⟦p1⟧
  delay({{ms}}); ⟦d1⟧
  digitalWrite(LED, LOW);           // 0 V：燈滅 ⟦off⟧
  Serial.println("滅"); ⟦p2⟧
  delay({{ms}}); ⟦d2⟧
}`,
  *run(io, p) {
    io.pinMode('D2', 'OUTPUT');
    yield { at: 's1' };
    yield { at: 's2' };
    for (;;) {
      io.digitalWrite('D2', 1);
      yield { at: 'on' };
      io.print('亮');
      yield { at: 'p1' };
      yield { at: 'd1', wait: p.ms };
      io.digitalWrite('D2', 0);
      yield { at: 'off' };
      io.print('滅');
      yield { at: 'p2' };
      yield { at: 'd2', wait: p.ms };
    }
  },
};

export const P_ESP_LED: ProgramDef = {
  id: 'esp-led',
  title: '外接 LED 閃爍（D18）',
  outputs: ['D18'],
  params: [{ key: 'ms', label: '等待毫秒', def: 500, min: 50, max: 3000 }],
  code: `const int LED = 18;           // 板子印 D18，程式就寫 18

void setup() {
  pinMode(LED, OUTPUT); ⟦s1⟧
}

void loop() {
  digitalWrite(LED, HIGH);    // 電流：D18 → 電阻 → LED → GND ⟦on⟧
  delay({{ms}}); ⟦d1⟧
  digitalWrite(LED, LOW); ⟦off⟧
  delay({{ms}}); ⟦d2⟧
}`,
  *run(io, p) {
    io.pinMode('D18', 'OUTPUT');
    yield { at: 's1' };
    for (;;) {
      io.digitalWrite('D18', 1);
      yield { at: 'on' };
      yield { at: 'd1', wait: p.ms };
      io.digitalWrite('D18', 0);
      yield { at: 'off' };
      yield { at: 'd2', wait: p.ms };
    }
  },
};

export const P_ESP_BUTTON: ProgramDef = {
  id: 'esp-button',
  title: '按鈕控制 LED（D4 → D18）',
  outputs: ['D18'],
  code: `const int BUTTON = 4;
const int LED = 18;

void setup() {
  // D4 有內建上拉；D34–D39 沒有，別把按鈕接在那裡
  pinMode(BUTTON, INPUT_PULLUP); ⟦s1⟧
  pinMode(LED, OUTPUT); ⟦s2⟧
}

void loop() {
  if (digitalRead(BUTTON) == LOW) {   // 按下去了？ ⟦r⟧
    digitalWrite(LED, HIGH); ⟦on⟧
  } else {
    digitalWrite(LED, LOW); ⟦off⟧
  }
}`,
  *run(io) {
    io.pinMode('D4', 'INPUT_PULLUP');
    yield { at: 's1' };
    io.pinMode('D18', 'OUTPUT');
    yield { at: 's2' };
    for (;;) {
      const v = io.digitalRead('D4');
      yield { at: 'r', wait: 8 };
      io.digitalWrite('D18', v === 0 ? 1 : 0);
      yield { at: v === 0 ? 'on' : 'off', wait: 8 };
    }
  },
};

export const P_ESP_POT: ProgramDef = {
  id: 'esp-pot',
  title: '旋鈕調亮度（D34 → D18 PWM）',
  outputs: ['D18'],
  code: `const int KNOB = 34;      // 只能輸入的 ADC1 腳，開 Wi-Fi 也能讀
const int LED = 18;

void setup() {
  pinMode(LED, OUTPUT); ⟦s1⟧
  Serial.begin(115200); ⟦s2⟧
}

void loop() {
  int val = analogRead(KNOB);       // 0–3.3 V → 0–4095（12 位元） ⟦r⟧
  int bright = val / 16;            // 4096 ÷ 16 = 256 階亮度 ⟦m⟧
  analogWrite(LED, bright);         // ESP32 幾乎每支輸出腳都能 PWM ⟦w⟧
  Serial.println(val); ⟦p⟧
  delay(100); ⟦d⟧
}`,
  *run(io) {
    io.pinMode('D18', 'OUTPUT');
    yield { at: 's1' };
    yield { at: 's2' };
    for (;;) {
      const val = to12bit(io.analogRead('D34'));
      yield { at: 'r', wait: 4 };
      const b = Math.floor(val / 16);
      yield { at: 'm', wait: 4 };
      io.analogWrite('D18', b);
      yield { at: 'w', wait: 4 };
      io.print(String(val));
      yield { at: 'p', wait: 4 };
      yield { at: 'd', wait: 100 };
    }
  },
};

export const ESP_WIFI_IP = '192.168.1.57';

export const P_ESP_WIFI: ProgramDef = {
  id: 'esp-wifi',
  title: 'Wi-Fi 網頁開關燈（D18）',
  outputs: ['D18'],
  code: `#include <WiFi.h>
#include <WebServer.h>

const char* ssid = "RobotLab";        // 換成你家的 Wi-Fi（只支援 2.4 GHz）
const char* password = "12345678";
const int LED = 18;
WebServer server(80);                  // 網頁伺服器開在第 80 埠

void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT); ⟦s1⟧
  WiFi.begin(ssid, password);          // 開始連線 ⟦wb⟧
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print("."); ⟦wt⟧
  }
  Serial.println(WiFi.localIP());      // 手機要輸入的網址 ⟦ip⟧
  server.on("/on", [] () {             // 有人打開 /on ⟦r1⟧
    digitalWrite(LED, HIGH);
    server.send(200, "text/plain", "LED 已開"); ⟦on⟧
  });
  server.on("/off", [] () { ⟦r2⟧
    digitalWrite(LED, LOW);
    server.send(200, "text/plain", "LED 已關"); ⟦off⟧
  });
  server.begin(); ⟦sb⟧
}

void loop() {
  server.handleClient();               // 看看有沒有人來敲門 ⟦hc⟧
}`,
  *run(io) {
    const web = useWeb.getState();
    web.reset();
    io.pinMode('D18', 'OUTPUT');
    yield { at: 's1' };
    io.print('連線到 Wi-Fi：RobotLab');
    yield { at: 'wb', wait: 200 };
    for (let i = 0; i < 5; i++) {
      io.print('.');
      yield { at: 'wt', wait: 300 };
    }
    useWeb.getState().connect(ESP_WIFI_IP);
    io.print(`已連線！IP 位址：${ESP_WIFI_IP}`);
    yield { at: 'ip', wait: 50 };
    yield { at: 'r1' };
    yield { at: 'r2' };
    io.print('網頁伺服器啟動，等手機連過來……');
    yield { at: 'sb' };
    for (;;) {
      const req = useWeb.getState().take();
      yield { at: 'hc', wait: 20 };
      if (req === '/on' || req === '/off') {
        const on = req === '/on';
        yield { at: on ? 'r1' : 'r2', wait: 30 };
        io.digitalWrite('D18', on ? 1 : 0);
        io.print(`GET ${req} → ${on ? 'LED 已開' : 'LED 已關'}`);
        useWeb.getState().served(req, on);
        yield { at: on ? 'on' : 'off', wait: 60 };
      } else if (req !== undefined) {
        io.print(`GET ${req} → 404 找不到這一頁`);
        yield { at: 'hc', wait: 30 };
      }
    }
  },
};

function* sweep(io: IO, pin: string, step: number) {
  for (;;) {
    for (let pos = 0; pos <= 180; pos += step) {
      yield { at: 'f1', wait: 1 };
      io.servoWrite(pin, pos);
      yield { at: 'w1', wait: 1 };
      yield { at: 'd1', wait: 15 };
    }
    for (let pos = 180; pos >= 0; pos -= step) {
      yield { at: 'f2', wait: 1 };
      io.servoWrite(pin, pos);
      yield { at: 'w2', wait: 1 };
      yield { at: 'd2', wait: 15 };
    }
  }
}

export const P_ESP_SERVO: ProgramDef = {
  id: 'esp-servo',
  title: '伺服機來回擺動（D13）',
  outputs: ['D13'],
  params: [{ key: 'step', label: '每次轉幾度', def: 2, min: 1, max: 30 }],
  code: `#include <ESP32Servo.h>   // ESP32 要用這個版本的 Servo 函式庫
Servo arm;

void setup() {
  arm.attach(13);              // 訊號線接 D13；3.3 V 的訊號 SG90 看得懂 ⟦a⟧
}

void loop() {
  for (int pos = 0; pos <= 180; pos += {{step}}) { ⟦f1⟧
    arm.write(pos); ⟦w1⟧
    delay(15); ⟦d1⟧
  }
  for (int pos = 180; pos >= 0; pos -= {{step}}) { ⟦f2⟧
    arm.write(pos); ⟦w2⟧
    delay(15); ⟦d2⟧
  }
}`,
  *run(io, p) {
    io.servoAttach('D13');
    yield { at: 'a' };
    yield* sweep(io, 'D13', Math.max(1, Math.round(p.step)));
  },
};

export const P_ESP_SONAR: ProgramDef = {
  id: 'esp-sonar',
  title: '超音波測距（TRIG D5／ECHO D19）',
  outputs: ['D5'],
  code: `const int TRIG = 5;
const int ECHO = 19;   // HC-SR04 的 ECHO 是 5 V，要先分壓再接進來

void setup() {
  pinMode(TRIG, OUTPUT); ⟦s1⟧
  pinMode(ECHO, INPUT); ⟦s2⟧
  Serial.begin(115200); ⟦s3⟧
}

void loop() {
  digitalWrite(TRIG, HIGH);       // 10 µs 觸發脈衝 ⟦t1⟧
  delayMicroseconds(10); ⟦t2⟧
  digitalWrite(TRIG, LOW); ⟦t3⟧
  long t = pulseIn(ECHO, HIGH); ⟦pi⟧
  float cm = t * 0.0343 / 2; ⟦cm⟧
  Serial.printf("距離：%.2f cm\\n", cm); ⟦p⟧
  delay(200); ⟦d⟧
}`,
  *run(io) {
    io.pinMode('D5', 'OUTPUT');
    yield { at: 's1' };
    io.pinMode('D19', 'INPUT');
    yield { at: 's2' };
    yield { at: 's3' };
    for (;;) {
      io.digitalWrite('D5', 1);
      yield { at: 't1', wait: 3 };
      yield { at: 't2', wait: 3 };
      io.digitalWrite('D5', 0);
      yield { at: 't3', wait: 3 };
      const t = io.pulseIn('D19', 'D5');
      yield { at: 'pi', wait: Math.max(4, t / 1000) };
      const cm = (t * 0.0343) / 2;
      yield { at: 'cm', wait: 3 };
      io.print(t === 0 ? '距離：0.00 cm（沒有收到回音）' : `距離：${cm.toFixed(2)} cm`);
      yield { at: 'p', wait: 3 };
      yield { at: 'd', wait: 200 };
    }
  },
};

export const P_ESP_MELODY: ProgramDef = {
  id: 'esp-melody',
  title: '蜂鳴器小旋律（D25）',
  outputs: ['D25'],
  code: `const int BUZZ = 25;
int notes[] = {523, 659, 784, 1047, 784, 1047};
int beats[] = {150, 150, 150, 300, 150, 450};

void setup() {
  pinMode(BUZZ, OUTPUT); ⟦s1⟧
}

void loop() {
  for (int i = 0; i < 6; i++) { ⟦f⟧
    tone(BUZZ, notes[i]);      // ESP32 核心 2.0 以後也支援 tone() ⟦t⟧
    delay(beats[i]); ⟦d⟧
    noTone(BUZZ); ⟦n⟧
    delay(40);
  }
  delay(1500); ⟦w⟧
}`,
  *run(io) {
    const notes = [523, 659, 784, 1047, 784, 1047];
    const beats = [150, 150, 150, 300, 150, 450];
    io.pinMode('D25', 'OUTPUT');
    yield { at: 's1' };
    for (;;) {
      for (let i = 0; i < 6; i++) {
        yield { at: 'f', wait: 1 };
        io.tone('D25', notes[i]);
        yield { at: 't', wait: 1 };
        yield { at: 'd', wait: beats[i] };
        io.noTone('D25');
        yield { at: 'n', wait: 40 };
      }
      yield { at: 'w', wait: 1500 };
    }
  },
};

/** 自由建構模式可選的程式（第 2 支是預設） */
export const ESP32_FREE_PROGRAMS: ProgramDef[] = [P_ESP_BLINK, P_ESP_LED, P_ESP_BUTTON, P_ESP_POT, P_ESP_WIFI, P_ESP_SERVO, P_ESP_SONAR, P_ESP_MELODY];
