; 自定义 NSIS：安装目录未包含应用名时自动追加 ${APP_FILENAME}（TraceMark）

; 栈：haystack, needle → 栈顶 1=包含，0=不包含
Function TraceMark_Contains
  Exch $R1
  Exch
  Exch $R0
  Push $R2
  Push $R3
  Push $R4
  Push $R5
  StrCpy $R2 -1
  StrLen $R3 $R1
  StrLen $R4 $R0
  TraceMark_loop:
    IntOp $R2 $R2 + 1
    StrCpy $R5 $R0 $R3 $R2
    StrCmp $R5 $R1 TraceMark_found
    StrCmp $R2 $R4 TraceMark_notfound
    Goto TraceMark_loop
  TraceMark_found:
    StrCpy $R0 1
    Goto TraceMark_end
  TraceMark_notfound:
    StrCpy $R0 0
  TraceMark_end:
    Pop $R5
    Pop $R4
    Pop $R3
    Pop $R2
    Exch $R0
    Pop $R1
FunctionEnd

; 返回栈顶 1=路径已含应用名，0=需要追加子目录
Function TraceMark_InstDirHasAppFolder
  Push $R0
  Push $R1

  Push "${APP_FILENAME}"
  Push $INSTDIR
  Call TraceMark_Contains
  Pop $R1
  IntCmp $R1 1 TraceMark_found

  Push "TraceMark"
  Push $INSTDIR
  Call TraceMark_Contains
  Pop $R1
  IntCmp $R1 1 TraceMark_found

  Push "TraceMark"
  Push $INSTDIR
  Call TraceMark_Contains
  Pop $R1
  IntCmp $R1 1 TraceMark_found

  Push "TraceMark"
  Push $INSTDIR
  Call TraceMark_Contains
  Pop $R1
  IntCmp $R1 1 TraceMark_found

  Push "tracemark"
  Push $INSTDIR
  Call TraceMark_Contains
  Pop $R1
  IntCmp $R1 1 TraceMark_found

  StrCpy $R0 0
  Goto TraceMark_done

  TraceMark_found:
  StrCpy $R0 1

  TraceMark_done:
  Exch $R0
  Pop $R1
FunctionEnd

Function TraceMark_EnsureInstSubdir
  Push $0
  Push $1
  StrLen $1 $INSTDIR
  IntCmp $1 0 TraceMark_skip_trim
  StrCpy $0 $INSTDIR 1 -1
  StrCmp $0 "\" 0 TraceMark_skip_trim
  IntOp $1 $1 - 1
  StrCpy $INSTDIR $INSTDIR $1
  TraceMark_skip_trim:
  Pop $1
  Pop $0

  Call TraceMark_InstDirHasAppFolder
  Pop $0
  IntCmp $0 1 TraceMark_no_append 0
  StrCpy $INSTDIR "$INSTDIR\${APP_FILENAME}"
  TraceMark_no_append:
FunctionEnd

Function .onVerifyInstDir
  Call TraceMark_EnsureInstSubdir
FunctionEnd
