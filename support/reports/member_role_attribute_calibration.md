# Member Role Attribute Calibration

Scenario: scenario_6
Groups: =LOVE (PUxPVkU), ≠ME (4omgTUU), ≒JOY (4omSSk9Z)
Reference date: 2025-07-05
Manual comparison rows: 9
Prediction rows: 34
- =LOVE: manual 9/10, roles 10/10
  Missing manual attributes: 大谷映美里
- ≠ME: manual 0/12, roles 12/12
  Missing manual attributes: 永田詩央里, 河口夏音, 蟹沢萌子, 菅波美玲, 谷崎早耶, 尾木波菜, 冨田菜々風, 本田珠由記, 落合希来里, 鈴木瞳美, 櫻井もも, 川中子奈月心
- ≒JOY: manual 0/12, roles 12/12
  Missing manual attributes: 逢田珠里依, 天野香乃愛, 市原愛弓, 江角怜音, 大信田美月, 大西葵, 小澤愛実, 髙橋舞, 藤沢莉子, 村山結香, 山田杏佳, 山野愛月
Ridge lambda: 0.05
Prior scalar: 3
Age features: age_youth, age_experience, age_senior

Baseline MAE: 1.864
Semantic prior MAE: 1.932
Prior-calibrated role model MAE: 0.370

## Worst Stats After Learning
- technical.breath: MAE 1.56, bias -0.22
- mental.clever: MAE 1.00, bias +0.11
- mental.determination: MAE 0.67, bias +0.00
- physical.natural_fitness: MAE 0.44, bias +0.00
- mental.talking: MAE 0.44, bias +0.00
- physical.agility: MAE 0.33, bias +0.11
- technical.rhythm: MAE 0.33, bias +0.11
- technical.power: MAE 0.33, bias -0.11

## Member Fit
- 髙松瞳: baseline 2.06 -> prior 2.22 -> learned 0.89
- 瀧脇笙古: baseline 1.56 -> prior 1.83 -> learned 0.83
- 佐々木舞香: baseline 1.56 -> prior 2.00 -> learned 0.56
- 大場花菜: baseline 2.67 -> prior 3.00 -> learned 0.50
- 齋藤樹愛羅: baseline 1.39 -> prior 1.17 -> learned 0.22
- 野口衣織: baseline 2.78 -> prior 2.28 -> learned 0.22
- 山本杏奈: baseline 1.83 -> prior 1.50 -> learned 0.11
- 音嶋莉沙: baseline 1.72 -> prior 1.89 -> learned 0.00
- 諸橋沙夏: baseline 1.22 -> prior 1.50 -> learned 0.00

## Strongest Learned Role Coefficients
### leader
- mental.clever: -5.15
- mental.teamwork: +4.59
- technical.grace: -3.98
- mental.talking: +3.85
- physical.strength: -3.13
- appearance.cute: +2.52

### center
- technical.breath: +5.69
- technical.grace: +3.17
- technical.power: +2.93
- technical.rhythm: +2.66
- technical.pitch: +2.61
- mental.teamwork: -2.56

### lead_singer
- mental.clever: +4.63
- technical.power: -4.00
- technical.breath: -2.72
- technical.grace: -2.66
- mental.talking: +2.44
- mental.determination: -2.35

### lead_dancer
- technical.breath: +8.69
- technical.power: +7.12
- mental.determination: +5.51
- mental.talking: -5.36
- physical.strength: +4.81
- technical.grace: +4.46

### host
- technical.breath: -10.33
- mental.clever: +6.50
- mental.talking: +5.08
- mental.determination: -4.08
- technical.pitch: -3.23
- mental.fashion: -2.79

### content
- technical.breath: +6.92
- physical.strength: -5.93
- mental.clever: -5.38
- appearance.cute: +4.56
- technical.rhythm: -3.27
- appearance.pretty: -2.88

### streaming
- mental.fashion: -5.80
- mental.clever: +5.27
- physical.natural_fitness: +4.16
- technical.breath: +3.06
- physical.agility: +2.75
- mental.humor: +2.36

### style
- technical.grace: +6.84
- physical.agility: +4.92
- mental.fashion: +4.53
- technical.power: +4.33
- technical.breath: -3.90
- mental.determination: -3.33

### call_leader
- technical.breath: -6.85
- mental.clever: -4.99
- physical.agility: -4.95
- technical.tone: -3.90
- technical.pitch: -3.68
- mental.humor: -3.33

### age_youth
- technical.breath: -6.40
- physical.strength: -4.97
- appearance.cute: +3.49
- mental.determination: -3.42
- technical.rhythm: -3.40
- technical.tone: -3.19

### age_experience
- mental.clever: -5.91
- appearance.cute: -3.67
- mental.humor: -3.06
- physical.natural_fitness: -3.02
- mental.talking: -2.78
- mental.fashion: +2.77

### age_senior
- technical.grace: -1.97
- mental.teamwork: +1.95
- mental.talking: +1.95
- physical.natural_fitness: -1.94
- technical.power: -1.85
- physical.stamina: -1.58

