-- conf.lua — configurazione finestra LÖVE
function love.conf(t)
  t.identity = "return-of-the-shadow"
  t.version  = "11.4"            -- compatibile con LÖVE 11.x
  t.window.title  = "THE RETURN OF THE SHADOW — Prologue: The Ascent"
  t.window.width  = 1280
  t.window.height = 720
  t.window.resizable = true
  t.window.vsync  = 1
  t.window.msaa   = 4            -- antialiasing per la grafica vettoriale
  t.modules.joystick = true
  t.modules.physics  = false     -- fisica scritta a mano, non serve Box2D
end
