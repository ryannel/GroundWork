# PR 10 size measurements

| Item | Original or live | Current or scratch | State |
| --- | ---: | ---: | --- |
| Volvo evidence SQLite | 9,508,937,728 bytes | 341,360,640 bytes | Scratch index built from canonical evidence. The live index includes analysis. |
| Tracked legacy Volvo explorer | 1,728 files, 9,323,386 bytes | 1,728 files | Retirement proof open. |
| Selected corpus generation | 3,929,256 KiB | Same | Live. |
| Unselected corpus generation | 3,568,816 KiB | Same | Retained. |
| Syntax cache | 28,309,472 KiB | Same | Retained. |
| Analysis cache | 3,782,951,805 bytes | 536,794,280 bytes | Local compressed history. Original bytes still retained while the retirement gate is open. |
| Evidence folder | 115,924 KiB | 119,212 KiB | Original format-1 and merged format-2 checkouts. |
| Volvo interpretation archive | — | 21,612 KiB | Added in Volvo PR 2. |
| Volvo historical entry archive | — | 38,358,195 bytes | Added in Volvo PR 3. |
| Domains folder | 16,580 KiB | 25,496 KiB | Original format-1 and merged format-2 checkouts. |

Folder sizes measure allocated space from `du -sk` on the same filesystem. The tracked
explorer byte count sums the actual file lengths. The scratch SQLite counts and query scope
are recorded in `pr10/archive-release.md`. The target sizes in design §8 describe the intended
post-retirement state.
