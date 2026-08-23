// One-off browser probe: renders the note envelope offline to check what a
// release scheduled *before* the attack ramp has finished actually does, and
// whether reading gain.value mid-ramp gives the release something to start from.
(async () => {
  const ATTACK = 0.015, TC = 0.12, STOP = TC * 6, RELEASE = 0.005;

  const render = async (fix) => {
    const ctx = new OfflineAudioContext(1, 48000 * 1.5, 48000);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, 0);
    env.gain.linearRampToValueAtTime(1, ATTACK);
    const src = ctx.createConstantSource();
    src.offset.value = 1;
    src.connect(env);
    env.connect(ctx.destination);
    src.start(0);

    // Stop the render at the release instant so the release is scheduled the
    // way noteOff schedules it: against a live clock, reading the value the
    // envelope has actually reached.
    let held = null;
    ctx.suspend(RELEASE).then(() => {
      held = env.gain.value;
      if (fix) {
        env.gain.cancelScheduledValues(ctx.currentTime);
        env.gain.setValueAtTime(held, ctx.currentTime);
      }
      env.gain.setTargetAtTime(0, ctx.currentTime, TC);
      src.stop(ctx.currentTime + STOP);
      ctx.resume();
    });

    const buf = await ctx.startRendering();
    const d = buf.getChannelData(0);
    const at = (t) => Number(d[Math.round(t * 48000)].toFixed(4));
    return { held, t20ms: at(0.02), t100ms: at(0.1), t400ms: at(0.4), atStop: at(RELEASE + STOP - 0.0005) };
  };

  return { asShipped: await render(false), withCancel: await render(true) };
})()
