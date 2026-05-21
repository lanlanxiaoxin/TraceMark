; 自定义 NSIS：安装目录未包含应用名时自动追加 ${APP_FILENAME}（TraceMack）

; 栈：haystack, needle → 栈顶 1=包含，0=不包含
Function TraceMack_Contains
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
  traceMack_loop:
    IntOp $R2 $R2 + 1
    StrCpy $R5 $R0 $R3 $R2
    StrCmp $R5 $R1 traceMack_found
    StrCmp $R2 $R4 traceMack_notfound
    Goto traceMack_loop
  traceMack_found:
    StrCpy $R0 1
    Goto traceMack_end
  traceMack_notfound:
    StrCpy $R0 0
  traceMack_end:
    Pop $R5
    Pop $R4
    Pop $R3
    Pop $R2
    Exch $R0
    Pop $R1
FunctionEnd

; 返回栈顶 1=路径已含应用名，0=需要追加子目录
Function TraceMack_InstDirHasAppFolder
  Push $R0
  Push $R1

  Push "${APP_FILENAME}"
  Push $INSTDIR
  Call TraceMack_Contains
  Pop $R1
  IntCmp $R1 1 traceMack_found

  Push "TraceMack"
  Push $INSTDIR
  Call TraceMack_Contains
  Pop $R1
  IntCmp $R1 1 traceMack_found

  Push "TraceMark"
  Push $INSTDIR
  Call TraceMack_Contains
  Pop $R1
  IntCmp $R1 1 traceMack_found

  Push "tracemack"
  Push $INSTDIR
  Call TraceMack_Contains
  Pop $R1
  IntCmp $R1 1 traceMack_found

  Push "tracemark"
  Push $INSTDIR
  Call TraceMack_Contains
  Pop $R1
  IntCmp $R1 1 traceMack_found

  StrCpy $R0 0
  Goto traceMack_done

  traceMack_found:
  StrCpy $R0 1

  traceMack_done:
  Exch $R0
  Pop $R1
FunctionEnd

Function TraceMack_EnsureInstSubdir
  Push $0
  Push $1
  StrLen $1 $INSTDIR
  IntCmp $1 0 traceMack_skip_trim
  StrCpy $0 $INSTDIR 1 -1
  StrCmp $0 "\" 0 traceMack_skip_trim
  IntOp $1 $1 - 1
  StrCpy $INSTDIR $INSTDIR $1
  traceMack_skip_trim:
  Pop $1
  Pop $0

  Call TraceMack_InstDirHasAppFolder
  Pop $0
  IntCmp $0 1 traceMack_no_append 0
  StrCpy $INSTDIR "$INSTDIR\${APP_FILENAME}"
  traceMack_no_append:
FunctionEnd

Function .onVerifyInstDir
  Call TraceMack_EnsureInstSubdir
FunctionEnd
