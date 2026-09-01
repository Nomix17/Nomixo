local fired = false

mp.register_event("start-file", function()
  fired = false
end)

mp.register_event("playback-restart", function()
  if not fired then
    fired = true
    print("MPV_WINDOW_OPENED")
  end
end)
