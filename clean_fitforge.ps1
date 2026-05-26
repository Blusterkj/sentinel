$archiveDir = "E:\FitForge_Archive"
New-Item -ItemType Directory -Force -Path $archiveDir

# Important stuff to move
$toMove = @(
    "c:\Users\blust\.gemini\antigravity\scratch\fitforge",
    "c:\Users\blust\.gemini\antigravity-backup\scratch\fitforge",
    "c:\Users\blust\.gemini\antigravity-ide\scratch\fitforge",
    "c:\Users\blust\OneDrive\Documents\FitForge - Comprehensive Project Report.docx",
    "c:\Users\blust\OneDrive\Documents\FitForge - Comprehensive Project Report2.docx",
    "c:\Users\blust\OneDrive\Documents\FITFORGE - Project Report nmiet.docx",
    "c:\Users\blust\OneDrive\Documents\FitForge - Project Report.docx"
)

foreach ($item in $toMove) {
    if (Test-Path $item) {
        $destName = Split-Path $item -Leaf
        # If it's a directory and there are duplicates, we might want to rename
        if (Test-Path "$archiveDir\$destName") {
             $parentName = Split-Path (Split-Path $item -Parent) -Leaf
             $destName = $parentName + "_" + $destName
        }
        Move-Item -Path $item -Destination "$archiveDir\$destName" -Force
    }
}

# Unimportant stuff to delete
$toDelete = @(
    "c:\Users\blust\.gemini\antigravity\brain\133f636b-7ad4-4d47-81ae-4540a760cdd9\fitforge_ppt_preview_1777545756705.webp",
    "c:\Users\blust\.gemini\antigravity\brain\61898d12-8998-4ad0-8a21-f822befc0901\blank_page_fitforge_1777392450366.png",
    "c:\Users\blust\.gemini\antigravity\brain\73e8bb41-c3f3-4e2e-a2fd-f13c739eed9d\fitforge_landing_page_1777444054259.png",
    "c:\Users\blust\.gemini\antigravity\brain\73e8bb41-c3f3-4e2e-a2fd-f13c739eed9d\fitforge_landing_page_1777444102870.png",
    "c:\Users\blust\.gemini\antigravity\brain\73e8bb41-c3f3-4e2e-a2fd-f13c739eed9d\fitforge_landing_page_hero_1777444131421.png",
    "c:\Users\blust\.gemini\antigravity-backup\brain\133f636b-7ad4-4d47-81ae-4540a760cdd9\fitforge_ppt_preview_1777545756705.webp",
    "c:\Users\blust\.gemini\antigravity-backup\brain\61898d12-8998-4ad0-8a21-f822befc0901\blank_page_fitforge_1777392450366.png",
    "c:\Users\blust\.gemini\antigravity-backup\brain\73e8bb41-c3f3-4e2e-a2fd-f13c739eed9d\fitforge_landing_page_1777444054259.png",
    "c:\Users\blust\.gemini\antigravity-backup\brain\73e8bb41-c3f3-4e2e-a2fd-f13c739eed9d\fitforge_landing_page_1777444102870.png",
    "c:\Users\blust\.gemini\antigravity-backup\brain\73e8bb41-c3f3-4e2e-a2fd-f13c739eed9d\fitforge_landing_page_hero_1777444131421.png",
    "c:\Users\blust\.gemini\antigravity-ide\brain\133f636b-7ad4-4d47-81ae-4540a760cdd9\fitforge_ppt_preview_1777545756705.webp",
    "c:\Users\blust\.gemini\antigravity-ide\brain\61898d12-8998-4ad0-8a21-f822befc0901\blank_page_fitforge_1777392450366.png",
    "c:\Users\blust\.gemini\antigravity-ide\brain\73e8bb41-c3f3-4e2e-a2fd-f13c739eed9d\fitforge_landing_page_1777444054259.png",
    "c:\Users\blust\.gemini\antigravity-ide\brain\73e8bb41-c3f3-4e2e-a2fd-f13c739eed9d\fitforge_landing_page_1777444102870.png",
    "c:\Users\blust\.gemini\antigravity-ide\brain\73e8bb41-c3f3-4e2e-a2fd-f13c739eed9d\fitforge_landing_page_hero_1777444131421.png",
    "c:\Users\blust\.gemini\antigravity-browser-profile\Default\IndexedDB\https_fitforgebase.web.app_0.indexeddb.leveldb",
    "c:\Users\blust\AppData\Local\Microsoft\Edge\User Data\Default\IndexedDB\https_fitforgebase.web.app_0.indexeddb.leveldb",
    "c:\Users\blust\AppData\Roaming\Microsoft\Office\Recent\FitForge - Comprehensive Project Report.LNK",
    "c:\Users\blust\AppData\Roaming\Microsoft\Office\Recent\FitForge - Project Report.LNK",
    "c:\Users\blust\AppData\Roaming\Microsoft\Windows\Recent\fitforge-nmiet-ppt.lnk",
    "c:\Users\blust\AppData\Roaming\Microsoft\Windows\Recent\fitforge-presentation-29.lnk",
    "c:\Users\blust\AppData\Roaming\Microsoft\Windows\Recent\fitforge-presentation.lnk",
    "c:\Users\blust\AppData\Roaming\Microsoft\Windows\Recent\FitForge-Project-Report-100.lnk",
    "c:\Users\blust\AppData\Roaming\Microsoft\Windows\Recent\FitForge-Project-Report.lnk",
    "c:\Users\blust\AppData\Roaming\Microsoft\Windows\Recent\FitForge.lnk"
)

foreach ($item in $toDelete) {
    if (Test-Path $item) {
        Remove-Item -Path $item -Recurse -Force
    }
}

Write-Output "Cleanup complete"
