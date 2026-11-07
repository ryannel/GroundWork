# PR 10 size measurements

| Item | Original or live | Current or scratch | State |
| --- | ---: | ---: | --- |
| Volvo evidence SQLite | 9,508,937,728 bytes | 340,377,600 bytes | Scratch index built from canonical evidence. The live index includes analysis. |
| Tracked legacy Volvo explorer | 1,728 files, 9,323,386 bytes | 1,728 files | Retirement proof open. |
| Selected corpus generation | 3,929,256 KiB | Same | Live. |
| Unselected corpus generation | 3,568,816 KiB | Same | Retained. |
| Syntax cache | 28,309,472 KiB | Same | Retained. |
| Analysis cache | 3,695,088 KiB | Same | Compression and retention decision pending. |
| Evidence folder | 115,924 KiB | 118,664 KiB | Original format-1 and merged format-2 checkouts. |
| Domains folder | 16,580 KiB | 25,496 KiB | Original format-1 and merged format-2 checkouts. |

Folder sizes measure allocated space from `du -sk` on the same filesystem. The tracked
explorer byte count sums the actual file lengths. The scratch SQLite counts and query scope
are recorded in `pr10/verification.md`. The target sizes in design §8 describe the intended
post-retirement state.
