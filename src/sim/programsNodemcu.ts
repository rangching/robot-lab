/**
 * NodeMCU（ESP8266）的任務程式與自由建構程式。
 * 寫法同 programs.ts：顯示用的 Arduino 程式碼＋對應的 JS 行為模擬；⟦tag⟧ 是高亮標記，{{key}} 是可調參數。
 * 程式裡一律寫板子上的 D 編號（D5），模擬器的腳位 id 也是 D 編號，兩邊一致。
 * ESP8266 的 analogRead() 本來就是 0–1023，analogWrite() 在核心 3.x 預設 0–255，和模擬器相同，不用換算。
 */
import type { IO, ProgramDef } from './programs';
import { useWeb } from './web';

export const P_NM_BLINK: ProgramDef = {
  id: 'nm-blink',
  title: '模組藍燈閃爍（LED_BUILTIN＝D4）',
  outputs: ['D4'],
  params: [{ key: 'ms', label: '等待毫秒', def: 500, min: 50, max: 3000 }],
  code: `// LED_BUILTIN 是模組上的藍燈，接在 D4（GPIO2）
// 它是「低電位亮」：LOW 開燈、HIGH 關燈

void setup() {
  pinMode(LED_BUILTIN, OUTPUT); ⟦s1⟧
  Serial.begin(115200); ⟦s2⟧
}

void loop() {
  digitalWrite(LED_BUILTIN, LOW);   // 0 V：燈反而亮 ⟦on⟧
  Serial.println("亮（LOW）"); ⟦p1⟧
  delay({{ms}}); ⟦d1⟧
  digitalWrite(LED_BUILTIN, HIGH);  // 3.3 V：燈滅 ⟦off⟧
  Serial.println("滅（HIGH）"); ⟦p2⟧
  delay({{ms}}); ⟦d2⟧
}`,
  *run(io, p) {
    io.pinMode('D4', 'OUTPUT');
    io.digitalWrite('D4', 1);
    yield { at: 's1' };
    yield { at: 's2' };
    for (;;) {
      io.digitalWrite('D4', 0);
      yield { at: 'on' };
      io.print('亮（LOW）');
      yield { at: 'p1' };
      yield { at: 'd1', wait: p.ms };
      io.digitalWrite('D4', 1);
      yield { at: 'off' };
      io.print('滅（HIGH）');
      yield { at: 'p2' };
      yield { at: 'd2', wait: p.ms };
    }
  },
};

export const P_NM_LED: ProgramDef = {
  id: 'nm-led',
  title: '外接 LED 閃爍（D5）',
  outputs: ['D5'],
  params: [{ key: 'ms', label: '等待毫秒', def: 500, min: 50, max: 3000 }],
  code: `const int LED = D5;          // 寫 D5，不要寫 5（5 是 GPIO5，也就是 D1）

void setup() {
  pinMode(LED, OUTPUT); ⟦s1⟧
}

void loop() {
  digitalWrite(LED, HIGH);   // 電流：D5 → 電阻 → LED → GND ⟦on⟧
  delay({{ms}}); ⟦d1⟧
  digitalWrite(LED, LOW); ⟦off⟧
  delay({{ms}}); ⟦d2⟧
}`,
  *run(io, p) {
    io.pinMode('D5', 'OUTPUT');
    yield { at: 's1' };
    for (;;) {
      io.digitalWrite('D5', 1);
      yield { at: 'on' };
      yield { at: 'd1', wait: p.ms };
      io.digitalWrite('D5', 0);
      yield { at: 'off' };
      yield { at: 'd2', wait: p.ms };
    }
  },
};

export const P_NM_BUTTON: ProgramDef = {
  id: 'nm-button',
  title: '按鈕控制 LED（D2 → D6）',
  outputs: ['D6'],
  code: `const int BUTTON = D2;   // D2 是 GPIO4：沒有開機限制、有內建上拉
const int LED = D6;      // D6 是 GPIO12

void setup() {
  pinMode(BUTTON, INPUT_PULLUP);    // 沒按時被拉到 3.3 V ⟦s1⟧
  pinMode(LED, OUTPUT); ⟦s2⟧
}

void loop() {
  if (digitalRead(BUTTON) == LOW) { // 按下去＝接到 GND ⟦r⟧
    digitalWrite(LED, HIGH); ⟦on⟧
  } else {
    digitalWrite(LED, LOW); ⟦off⟧
  }
}`,
  *run(io) {
    io.pinMode('D2', 'INPUT_PULLUP');
    yield { at: 's1' };
    io.pinMode('D6', 'OUTPUT');
    yield { at: 's2' };
    for (;;) {
      const v = io.digitalRead('D2');
      yield { at: 'r', wait: 8 };
      io.digitalWrite('D6', v === 0 ? 1 : 0);
      yield { at: v === 0 ? 'on' : 'off', wait: 8 };
    }
  },
};

export const P_NM_POT: ProgramDef = {
  id: 'nm-pot',
  title: '旋鈕調亮度（A0 → D5 PWM）',
  outputs: ['D5'],
  code: `const int LED = D5;

void setup() {
  pinMode(LED, OUTPUT); ⟦s1⟧
  Serial.begin(115200); ⟦s2⟧
}

void loop() {
  int val = analogRead(A0);         // 唯一的類比腳：0–3.3 V → 0–1023 ⟦r⟧
  int bright = val / 4;             // 1024 ÷ 4 = 256 階亮度 ⟦m⟧
  analogWrite(LED, bright);         // 核心 3.x 預設範圍 0–255 ⟦w⟧
  Serial.println(val); ⟦p⟧
  delay(100); ⟦d⟧
}`,
  *run(io) {
    io.pinMode('D5', 'OUTPUT');
    yield { at: 's1' };
    yield { at: 's2' };
    for (;;) {
      const val = io.analogRead('A0');
      yield { at: 'r', wait: 4 };
      const b = Math.floor(val / 4);
      yield { at: 'm', wait: 4 };
      io.analogWrite('D5', b);
      yield { at: 'w', wait: 4 };
      io.print(String(val));
      yield { at: 'p', wait: 4 };
      yield { at: 'd', wait: 100 };
    }
  },
};

export const NM_WIFI_IP = '192.168.1.66';

export const P_NM_WIFI: ProgramDef = {
  id: 'nm-wifi',
  title: 'Wi-Fi 網頁開關燈（D5）',
  outputs: ['D5'],
  code: `#include <ESP8266WiFi.h>
#include <ESP8266WebServer.h>

const char* ssid = "RobotLab";        // 換成你家的 Wi-Fi（只支援 2.4 GHz）
const char* password = "12345678";
const int LED = D5;
ESP8266WebServer server(80);           // 網頁伺服器開在第 80 埠

void setup() {
  Serial.begin(115200);
  pinMode(LED, OUTPUT); ⟦s1⟧
  WiFi.mode(WIFI_STA);                 // 當一般裝置，不要順便開基地台
  WiFi.begin(ssid, password); ⟦wb⟧
  while (WiFi.status() != WL_CONNECTED) {
    delay(300);
    Serial.print("."); ⟦wt⟧
  }
  Serial.println(WiFi.localIP());      // 手機要輸入的網址 ⟦ip⟧
  server.on("/on", [] () { ⟦r1⟧
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
    useWeb.getState().reset();
    io.pinMode('D5', 'OUTPUT');
    yield { at: 's1' };
    io.print('連線到 Wi-Fi：RobotLab');
    yield { at: 'wb', wait: 200 };
    for (let i = 0; i < 6; i++) {
      io.print('.');
      yield { at: 'wt', wait: 300 };
    }
    useWeb.getState().connect(NM_WIFI_IP);
    io.print(`已連線！IP 位址：${NM_WIFI_IP}`);
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
        io.digitalWrite('D5', on ? 1 : 0);
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

export const P_NM_SERVO: ProgramDef = {
  id: 'nm-servo',
  title: '伺服機來回擺動（D7）',
  outputs: ['D7'],
  params: [{ key: 'step', label: '每次轉幾度', def: 2, min: 1, max: 30 }],
  code: `#include <Servo.h>      // ESP8266 核心內建自己的 Servo 函式庫
Servo arm;

void setup() {
  arm.attach(D7);          // 訊號線接 D7；伺服機本身請用外接 5 V 供電 ⟦a⟧
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
    io.servoAttach('D7');
    yield { at: 'a' };
    yield* sweep(io, 'D7', Math.max(1, Math.round(p.step)));
  },
};

export const P_NM_SONAR: ProgramDef = {
  id: 'nm-sonar',
  title: '超音波測距（TRIG D6／ECHO D7）',
  outputs: ['D6'],
  code: `const int TRIG = D6;
const int ECHO = D7;   // HC-SR04 的 ECHO 是 5 V，要先分壓再接進來

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
    io.pinMode('D6', 'OUTPUT');
    yield { at: 's1' };
    io.pinMode('D7', 'INPUT');
    yield { at: 's2' };
    yield { at: 's3' };
    for (;;) {
      io.digitalWrite('D6', 1);
      yield { at: 't1', wait: 3 };
      yield { at: 't2', wait: 3 };
      io.digitalWrite('D6', 0);
      yield { at: 't3', wait: 3 };
      const t = io.pulseIn('D7', 'D6');
      yield { at: 'pi', wait: Math.max(4, t / 1000) };
      const cm = (t * 0.0343) / 2;
      yield { at: 'cm', wait: 3 };
      io.print(t === 0 ? '距離：0.00 cm（沒有收到回音）' : `距離：${cm.toFixed(2)} cm`);
      yield { at: 'p', wait: 3 };
      yield { at: 'd', wait: 200 };
    }
  },
};

export const P_NM_MELODY: ProgramDef = {
  id: 'nm-melody',
  title: '蜂鳴器小旋律（D1）',
  outputs: ['D1'],
  code: `const int BUZZ = D1;
int notes[] = {523, 659, 784, 1047, 784, 1047};
int beats[] = {150, 150, 150, 300, 150, 450};

void setup() {
  pinMode(BUZZ, OUTPUT); ⟦s1⟧
}

void loop() {
  for (int i = 0; i < 6; i++) { ⟦f⟧
    tone(BUZZ, notes[i]); ⟦t⟧
    delay(beats[i]); ⟦d⟧
    noTone(BUZZ); ⟦n⟧
    delay(40);
  }
  delay(1500); ⟦w⟧
}`,
  *run(io) {
    const notes = [523, 659, 784, 1047, 784, 1047];
    const beats = [150, 150, 150, 300, 150, 450];
    io.pinMode('D1', 'OUTPUT');
    yield { at: 's1' };
    for (;;) {
      for (let i = 0; i < 6; i++) {
        yield { at: 'f', wait: 1 };
        io.tone('D1', notes[i]);
        yield { at: 't', wait: 1 };
        yield { at: 'd', wait: beats[i] };
        io.noTone('D1');
        yield { at: 'n', wait: 40 };
      }
      yield { at: 'w', wait: 1500 };
    }
  },
};

/** 自由建構模式可選的程式（第 2 支是預設） */
export const NODEMCU_FREE_PROGRAMS: ProgramDef[] = [P_NM_BLINK, P_NM_LED, P_NM_BUTTON, P_NM_POT, P_NM_WIFI, P_NM_SERVO, P_NM_SONAR, P_NM_MELODY];
