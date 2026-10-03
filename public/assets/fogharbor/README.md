# 雾港美术素材

所有运行时素材都保存在本目录，游戏无需访问本机素材库或图像生成服务。

| 文件 | 来源与用途 |
| --- | --- |
| `sui-reference.png` | 本机 `my-pixijs-game/public/reference_images/岁己小红帽立绘.png` 的原图副本，4000×6000；用于三维角色造型依据 |
| `sui-portrait.webp` | 同一立绘的脸部与上身裁切，384×432；用于基地、行动 HUD 和结算头像 |
| `harbor-dawn.webp` | 内置 ImageGen 生成的雨后港湾远景，1672×941；用于基地与结算背景 |
| `dock-paving.webp` | 内置 ImageGen 生成的地面纹理，缩放为 1024×1024 WebP；用于港区铺装 |
| `painted-steel.webp` | 内置 ImageGen 生成的钢板纹理，缩放为 1024×1024 WebP；用于集装箱与设施 |

角色、敌人、枪械和工业构件由项目内 Three.js 几何体构建。角色身份没有通过生成头像替换；游戏中的红帽、白色双马尾、红瞳、羽翼、格纹裙和金色光环均依照原立绘制作。小鸟沿用项目已有的 `public/assets/sui-bird.png`。

以下是对应生成规格的整理版复现提示词。原始 PNG 留在生成主机的 `C:/Users/yuiffy/.codex/generated_images/01a0fcfe-0dfb-78a0-80f0-9dc4adc896ed/`；项目直接使用本目录的 WebP。

## 港湾远景

原始输出：`exec-2134b951-8b69-42eb-9887-b4f6808799e4.png`。

> A cinematic panoramic industrial harbor at dawn after rain. Cold blue sea mist, warm amber dock lights, wet waterfront reflections, distant warehouses, container cranes and a cargo ship. Layered atmospheric depth, believable weathered industrial details, a quiet foreground suitable for a game character presentation. Restrained color palette and soft morning light. Wide landscape composition. No people, characters, logos, letters, interface elements or text.

## 港区铺装

原始输出：`exec-d904e362-160f-44b2-8220-37f5101351ed.png`。

> Seamless square top-down material scan of wet charcoal-gray concrete and asphalt paving for an industrial dock. Fine realistic aggregate, subtle worn patches and rain-darkened variation. Even neutral illumination, no directional shadows, no perspective. Restrained surface contrast so small game characters remain readable. Tileable across all edges. No road markings, objects, litter, large puddles, text or logos.

## 船用钢板

原始输出：`exec-86a34388-39d5-493f-bc52-3f7673e54372.png`。

> Seamless square top-down material scan of pale gray painted marine steel. Weathered paint with restrained rust flecks, fine scratches and subtle surface variation. Even neutral illumination, no perspective or directional shadows. Tileable across all edges. Suitable for corrugated cargo containers and harbor equipment modeled separately in 3D. No seams, corrugation geometry, rivets, objects, lettering or logos.
