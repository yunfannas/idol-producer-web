# Member Role Attribute Calibration

Scenario: scenario_6
Groups: =LOVE (PUxPVkU), iLiFE! (aUxpRkUh), 高嶺のなでしこ (6auY5ba644Gu44Gq44Gn44GX44GT), アキシブproject (44Ki44Kt44K344OWcHJvamVjdA)
Reference date: 2025-07-05
Manual comparison rows: 37
Prediction rows: 37
- =LOVE: manual 10/10, roles 10/10
- iLiFE!: manual 9/9, roles 1/9
- 高嶺のなでしこ: manual 10/10, roles 1/10
- アキシブproject: manual 8/8, roles 0/8
Ridge lambda: 6
Prior scalar: 3
Age features: age_youth, age_experience, age_senior

Baseline MAE: 2.179
Semantic prior MAE: 2.207
Prior-calibrated role model MAE: 1.854

## Worst Stats After Learning
- technical.breath: MAE 2.51, bias +0.57
- mental.fashion: MAE 2.35, bias +1.05
- technical.pitch: MAE 2.19, bias +0.51
- technical.grace: MAE 2.08, bias +0.51
- technical.tone: MAE 2.05, bias +0.49
- physical.agility: MAE 2.00, bias +0.76
- technical.rhythm: MAE 2.00, bias +0.54
- mental.talking: MAE 2.00, bias +0.59

## Member Fit
- 春野莉々: baseline 3.33 -> prior 3.33 -> learned 3.06
- 平沢かえ: baseline 3.06 -> prior 3.06 -> learned 2.78
- 松本ももな: baseline 2.94 -> prior 2.94 -> learned 2.67
- 葵ふう: baseline 2.83 -> prior 2.83 -> learned 2.67
- 如月なな: baseline 3.06 -> prior 3.06 -> learned 2.44
- 福丸うさ: baseline 2.33 -> prior 2.33 -> learned 2.39
- 小熊まむ: baseline 2.56 -> prior 2.56 -> learned 2.39
- 古賀みれい: baseline 2.83 -> prior 2.83 -> learned 2.33
- 大場花菜: baseline 2.67 -> prior 3.00 -> learned 2.28
- 美山ひな: baseline 2.67 -> prior 2.72 -> learned 2.28
- 野口衣織: baseline 2.78 -> prior 2.17 -> learned 2.22
- 葉月紗蘭: baseline 2.50 -> prior 2.56 -> learned 2.22
- 水琴まなみ: baseline 2.28 -> prior 2.28 -> learned 2.00
- 日向端ひな: baseline 2.22 -> prior 2.22 -> learned 1.94
- 籾山ひめり: baseline 2.56 -> prior 2.44 -> learned 1.94
- 髙松瞳: baseline 2.06 -> prior 2.22 -> learned 1.89
- 清見るん: baseline 2.06 -> prior 2.06 -> learned 1.78
- 若葉のあ: baseline 2.06 -> prior 2.11 -> learned 1.72
- 城月菜央: baseline 2.00 -> prior 2.00 -> learned 1.72
- 大谷映美里: baseline 2.44 -> prior 2.72 -> learned 1.67
- 音嶋莉沙: baseline 1.67 -> prior 1.72 -> learned 1.67
- あいす: baseline 1.44 -> prior 1.44 -> learned 1.61
- 純嶺みき: baseline 1.89 -> prior 1.89 -> learned 1.61
- 山本杏奈: baseline 2.11 -> prior 1.78 -> learned 1.56
- 心花りり: baseline 1.50 -> prior 1.83 -> learned 1.56
- 那蘭のどか: baseline 1.94 -> prior 1.94 -> learned 1.56
- 橋本桃呼: baseline 1.72 -> prior 1.72 -> learned 1.56
- 茉井良菜: baseline 2.17 -> prior 2.28 -> learned 1.56
- 東山恵里沙: baseline 2.11 -> prior 2.11 -> learned 1.50
- 星谷美来: baseline 1.83 -> prior 1.83 -> learned 1.44
- 虹羽みに: baseline 1.50 -> prior 1.56 -> learned 1.39
- 瀧脇笙古: baseline 1.56 -> prior 1.83 -> learned 1.33
- 齋藤樹愛羅: baseline 1.39 -> prior 1.17 -> learned 1.22
- 佐々木舞香: baseline 1.56 -> prior 1.78 -> learned 1.22
- 涼海すう: baseline 1.83 -> prior 1.89 -> learned 1.22
- 諸橋沙夏: baseline 1.50 -> prior 1.78 -> learned 1.17
- 空詩かれん: baseline 1.67 -> prior 1.67 -> learned 1.06

## Strongest Learned Role Coefficients
### leader
- mental.teamwork: +2.89
- mental.talking: +1.31
- mental.determination: +1.31
- physical.agility: +0.90
- technical.tone: +0.75
- technical.pitch: +0.74

### center
- appearance.pretty: +1.95
- appearance.cute: +1.26
- technical.grace: +0.85
- technical.rhythm: +0.60
- mental.teamwork: -0.47
- physical.agility: -0.40

### lead_singer
- technical.pitch: +2.69
- technical.breath: +2.52
- technical.tone: +2.40
- technical.power: +0.76
- mental.determination: +0.73
- physical.agility: -0.52

### lead_dancer
- technical.rhythm: +2.73
- technical.grace: +2.51
- technical.power: +2.02
- physical.agility: +1.98
- physical.stamina: +1.65
- physical.natural_fitness: +1.24

### host
- mental.talking: +2.22
- mental.humor: +1.60
- mental.clever: +1.08
- mental.teamwork: +0.62
- technical.grace: -0.54
- mental.fashion: -0.45

### content
- mental.humor: +1.73
- mental.talking: +1.06
- mental.fashion: +0.76
- technical.tone: -0.72
- physical.strength: -0.67
- mental.clever: +0.62

### streaming
- mental.talking: +1.25
- technical.grace: -0.83
- mental.determination: -0.81
- mental.humor: +0.80
- mental.teamwork: +0.69
- technical.rhythm: -0.65

### style
- mental.fashion: +3.47
- appearance.cute: +2.29
- appearance.pretty: +2.12
- technical.grace: +0.68
- physical.agility: +0.57
- technical.power: +0.53

### call_leader
- mental.talking: +1.96
- mental.determination: +1.18
- physical.stamina: +0.87
- technical.power: +0.80
- mental.clever: -0.67
- mental.humor: +0.58

### age_youth
- mental.fashion: -2.21
- physical.natural_fitness: -1.66
- mental.clever: -1.59
- mental.determination: -1.38
- physical.stamina: -1.25
- mental.talking: -1.22

### age_experience
- mental.humor: -1.98
- mental.determination: -1.93
- mental.clever: -1.40
- physical.stamina: -1.38
- physical.natural_fitness: -1.31
- mental.talking: -1.21

### age_senior
- mental.teamwork: +1.03
- mental.clever: +0.82
- mental.talking: +0.62
- mental.determination: +0.59

