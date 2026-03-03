import os
import json

games_dir = "/Users/kyd/projects/hypergame/public/games"

descriptions = {
    "2048": {
        "folder": "2048",
        "en": {
            "desc": "A mesmerizing neon puzzle game. Slide tiles and combine matching numbers to reach the ultimate 2048 tile!",
            "instruction": "Use arrow keys or swipe to move all tiles. When two tiles with the same number touch, they merge into one. Reach 2048 to win!"
        },
        "ko": {
            "desc": "화려한 네온빛 퍼즐 게임! 타일을 밀고 같은 숫자를 합쳐서 궁극의 2048 타일을 완성하세요.",
            "instruction": "방향키나 스와이프를 사용해 타일을 움직이세요. 같은 숫자의 타일이 닿으면 하나로 합쳐집니다. 2048을 만들면 승리합니다!"
        }
    },
    "stack": {
        "folder": "stack",
        "en": {
            "desc": "Test your timing and reflexes! Drop blocks precisely on top of each other to build the highest neon tower possible.",
            "instruction": "Click or tap the screen at the exact moment the moving block aligns with the tower. Mismatched parts will be sliced off!"
        },
        "ko": {
            "desc": "당신의 타이밍과 순발력을 시험해보세요! 움직이는 블록을 정확히 쌓아 올려 세상에서 가장 높은 네온 타워를 만드세요.",
            "instruction": "움직이는 블록이 타워 위에 정확히 위치할 때 화면을 클릭하거나 터치하세요. 어긋난 부분은 잘려나갑니다!"
        }
    },
    "zigzag": {
        "folder": "zigzag",
        "en": {
            "desc": "Stay on the wall and do as many zigzags as you can! A fast-paced endless runner with retro aesthetics.",
            "instruction": "Tap the screen or click to change the direction of the ball. Don't fall off the edge and collect gems for extra points!"
        },
        "ko": {
            "desc": "아슬아슬한 벽 위를 달리며 끝없이 지그재그로 이동하세요! 레트로 감성의 빠른 템포를 가진 무한 러너 게임입니다.",
            "instruction": "화면을 터치하거나 클릭해 공의 방향을 바꾸세요. 가장자리로 떨어지지 않게 조심하며 보석을 모아 추가 점수를 얻으세요!"
        }
    },
    "jump": {
        "folder": "jump",
        "en": {
            "desc": "Help the Rocket Snail fly through an endless course of classic green pipes and dodge the hungry carnivorous plants!",
            "instruction": "Press Spacebar, click, or tap the screen to make the snail jump. Time your jumps perfectly to avoid crashing into the pipes or plants."
        },
        "ko": {
            "desc": "로켓 달팽이를 조종해 초록색 파이프 사이를 날아오르고 튀어나오는 식충 식물들을 피해 최대한 멀리 가세요!",
            "instruction": "스페이스바를 누르거나 화면을 터치하면 달팽이가 뛰어오릅니다. 파이프와 식충 식물에 부딪히지 않도록 완벽한 타이밍에 점프하세요."
        }
    },
    "breakout": {
        "folder": "breakout",
        "en": {
            "desc": "Experience classic arcade brick-breaking action enhanced with high-octane neon visuals and explosive particle effects!",
            "instruction": "Use your mouse, arrow keys, or touch to move the paddle. Bounce the ball to break all the glowing neon bricks and clear the level."
        },
        "ko": {
            "desc": "눈을 뗄 수 없는 화려한 파티클 효과와 네온 비주얼로 업그레이드된 클래식 아케이드 벽돌 깨기를 즐겨보세요!",
            "instruction": "마우스, 방향키 또는 화면 터치로 패들을 움직이세요. 공을 튕겨내어 빛나는 네온 벽돌을 모두 부수고 스테이지를 클리어하세요."
        }
    },
    "helix": {
        "folder": "helix",
        "en": {
            "desc": "A satisfying and thrilling arcade experience! Rotate the spiral tower to plunge your bouncing ball all the way to the bottom.",
            "instruction": "Click and drag (or swipe) left and right to rotate the tower. Let the ball fall through the gaps, but avoid the dangerously colored platforms!"
        },
        "ko": {
            "desc": "짜릿한 타격감의 아케이드 게임! 나선형 타워를 회전시켜 튕기는 공을 맨 아래층까지 무사히 내려보내세요.",
            "instruction": "마우스를 클릭하고 좌우로 드래그(또는 스와이프)하여 타워를 회전시키세요. 빈 공간으로 공을 떨어뜨리되, 위험한 색상의 발판은 피해야 합니다!"
        }
    },
    "geometry": {
        "folder": "geometry",
        "en": {
            "desc": "Prepare for a nearly impossible challenge! Jump, fly, and flip your way through dangerous passages and spiky obstacles.",
            "instruction": "Tap the screen or press Spacebar to jump over spikes and obstacles. One mistake and it's back to the beginning!"
        },
        "ko": {
            "desc": "불가능에 가까운 짜릿한 난이도! 수많은 가시와 위험한 장애물들을 피하며 리듬에 맞춰 점프하고 비행하세요.",
            "instruction": "화면을 터치하거나 스페이스바를 눌러 가시와 장애물을 뛰어넘으세요. 단 한 번의 실수라도 처음부터 다시 시작해야 합니다!"
        }
    },
    "domino": {
        "folder": "domino",
        "en": {
            "desc": "A clever puzzle game of chain reactions. Strategically place the right-sized dominoes to complete the circuit!",
            "instruction": "Observe the gaps between blocks. Select and drop the appropriately sized domino to connect them and trigger a continuous fall."
        },
        "ko": {
            "desc": "연쇄 반응을 활용하는 두뇌 퍼즐 게임입니다. 알맞은 크기의 도미노를 전략적으로 배치하여 회로를 완성하세요!",
            "instruction": "블록 사이의 간격을 확인하세요. 딱 맞는 크기의 도미노를 선택해 내려놓으면 도미노가 끊기지 않고 쓰러지게 됩니다."
        }
    },
    "minesweeper": {
        "folder": "minesweeper",
        "en": {
            "desc": "The classic PC logic puzzle returns with a sleek neon style. clear the board without detonating a single hidden mine!",
            "instruction": "Left-click to reveal a tile. Right-click to flag a suspected mine. The numbers indicate how many mines are adjacent to that tile."
        },
        "ko": {
            "desc": "고전 명작 논리 퍼즐이 세련된 네온 스타일로 돌아왔습니다. 숨겨진 지뢰를 건드리지 않고 모든 안전 지대를 찾아내세요!",
            "instruction": "좌클릭으로 칸을 엽니다. 우클릭으로는 지뢰가 예상되는 곳에 깃발을 꽂아둡니다. 칸 안의 숫자는 주변 8칸에 숨겨진 지뢰의 총 개수를 의미합니다."
        }
    },
    "bulletdodge": {
        "folder": "bulletdodge",
        "en": {
            "desc": "A relentless neon bullet-hell survival challenge. Dodge thousands of approaching lasers and see how long you can last!",
            "instruction": "Use the on-screen joystick, WASD, or arrow keys to maneuver your core. Avoid every red projectile and survive as long as possible."
        },
        "ko": {
            "desc": "숨 막히는 네온 탄막 생존 게임! 사방에서 몰려오는 수천 개의 레이저들을 피하며 자신의 한계를 시험하세요.",
            "instruction": "화면의 조이스틱, WASD, 혹은 방향키를 사용해 코어를 움직이세요. 붉은색 발사체와 파티클을 모두 피하며 살아남아야 합니다."
        }
    }
}

updated = 0
for game_key, content in descriptions.items():
    folder = content["folder"]
    for lang in ["en", "ko"]:
        loc_path = os.path.join(games_dir, folder, "locales", lang, "translation.json")
        if os.path.exists(loc_path):
            with open(loc_path, "r", encoding="utf-8") as f:
                try:
                    data = json.load(f)
                except:
                    continue
            
            data["desc"] = content[lang]["desc"]
            data["instruction"] = content[lang]["instruction"]
            
            with open(loc_path, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            updated += 1

print(f"Rich descriptions and detailed instructions updated in {updated} locale files.")
