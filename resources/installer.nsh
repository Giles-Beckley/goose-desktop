!macro customInit
  ; Kill any running instances of Goose Commerce before installing
  nsExec::ExecToStack 'taskkill /F /IM "Goose Commerce.exe"'
  Pop $0 ; return value
  Pop $1 ; output
  ; Brief pause to let processes fully terminate
  Sleep 1000
!macroend
