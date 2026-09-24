# Projektmunkafolyamatok

Az `AGENTS.md` a projekt állandó belépési pontja. Ez a fájl index, önmagában
nem automatikusan betöltött skill. A tényleges készségek:

| Skill | Mikor használd? |
| --- | --- |
| [session-handoff](skills/session-handoff/SKILL.md) | Projekt folytatása vagy munkamenet átadása |
| [game-invariants](skills/game-invariants/SKILL.md) | Körök, határidő, pontozás, jogosultság változtatása |

A jelenlegi környezet `.agents/` könyvtára csak olvasható, ezért a források a
verziózható `skills/` könyvtárban vannak. Az `AGENTS.md` közvetlenül hivatkozik rájuk.
Egy írható checkoutban a `skills/` alkönyvtárai átmásolhatók a `.agents/skills/`
könyvtárba az automatikus felfedezéshez. Ne tarts fenn eltérő másolatokat.
Lásd: [hivatalos skill dokumentáció](https://learn.chatgpt.com/docs/build-skills).
