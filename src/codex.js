// The Engineer's Codex: bite-size real-world background for the in-game tech.
export const CODEX = [
  {
    title: 'The Transistor',
    body: `Every part on your robot's board is built from <b>MOSFETs</b> — metal-oxide
      field-effect transistors. A MOSFET is just an electrically controlled switch:
      voltage on the gate lets current flow between source and drain.<br><br>
      That's it. That's the whole trick. Switches that control switches. A modern GPU
      packs over <b>200 billion</b> of them, each one smaller than a flu virus, and every
      single one is doing what your BAT→THR wire does: deciding whether a signal passes.`,
  },
  {
    title: 'Logic Gates & CMOS',
    body: `Pair transistors up and you get <b>gates</b>. In CMOS, every gate is built from
      complementary pairs: a NOT is 2 transistors, NAND is 4, AND is 6.<br><br>
      <b>NAND is universal</b> — any circuit, including an entire CPU, can be built from
      NAND gates alone. The Apollo Guidance Computer that landed on the Moon was built
      almost entirely from one chip type: a 3-input NOR. Your robot is in good company.`,
  },
  {
    title: "Moore's Law & the 2 nm Era",
    body: `In 1965 Gordon Moore noticed transistor counts doubling roughly every two years.
      Sixty years later we're fabricating at the <b>"2 nanometer" node</b> with
      gate-all-around (GAA) nanosheet transistors — silicon channels a few atoms thick,
      wrapped entirely by their gate for better control and less leakage.<br><br>
      Scaling is now as much about <b>packaging</b> as shrinking: chiplets, 3D stacking and
      hybrid bonding glue many dies into one "chip", much like you snap burned ICs
      into different robots.`,
  },
  {
    title: 'Photolithography & EUV',
    body: `Chips are printed with light. <b>EUV lithography</b> machines focus 13.5 nm
      extreme-ultraviolet light — made by vaporizing tin droplets with a laser, 50,000
      times a second — through the flattest mirrors ever made, onto wafers, layer by
      layer, sometimes 80+ layers deep.<br><br>
      A single EUV scanner costs more than an airliner. The fab you're escaping
      from would own a dozen.`,
  },
  {
    title: 'Tapeout: Burning Your Own Chip',
    body: `Real chip design works exactly like your BURN CHIP button: engineers describe
      logic (in languages like Verilog), tools synthesize it into gates, and the final
      design is "taped out" — sent to a foundry to be manufactured.<br><br>
      The PIN▸ and ▸PIN pads on your board are your chip's <b>I/O ring</b>. Everything
      between them becomes the die. Package it once, reuse it everywhere — that's the
      entire economic miracle of the integrated circuit, first pulled off by Kilby and
      Noyce in 1958-59.`,
  },
  {
    title: 'Flip-Flops & Memory',
    body: `Feed two gates into each other and the loop <b>remembers</b>. Your FLIP part is an
      SR latch — the same cross-coupled structure as an SRAM cell in a CPU cache,
      where six transistors hold one bit for as long as the power is on.<br><br>
      Add a clock and you get registers; add registers and a counter and you get a
      <b>state machine</b> — which is precisely what your loop-running robot in the
      Cleanroom is.`,
  },
  {
    title: 'The Clock',
    body: `Every digital system marches to a <b>clock</b> — a quartz crystal or on-chip
      oscillator ticking billions of times per second. Between ticks, signals race
      through gates and must settle before the next tick; that race is why
      <i>propagation delay</i> (your DLY part) rules chip design.<br><br>
      Your robot's board steps 20 times a second. A laptop CPU steps 5,000,000,000
      times a second. Same idea, more hurry.`,
  },
  {
    title: 'The Perceptron (your NPU part)',
    body: `In 1958 Frank Rosenblatt built the <b>perceptron</b>: multiply each input by a
      weight, add them up, fire if the sum clears a threshold. One artificial neuron.<br><br>
      Your NPU part is exactly that, with weights of -1, 0, or +1. It can learn
      "follow the player unless touching a wall" — and stacking millions of them in
      layers, with learned weights, is all a deep neural network is.`,
  },
  {
    title: 'AI Accelerators',
    body: `Modern AI chips — NPUs, TPUs, GPU tensor cores — are mostly gigantic grids of
      multiply-accumulate units: your NPU part, tiled tens of thousands of times,
      fed by heroic memory systems.<br><br>
      The frontier models of the 2020s are <b>transformers</b>: networks that learn which
      parts of their input to pay attention to. They run on the same silicon physics
      as your board — just with about 10<sup>15</sup> more transistors on the job.`,
  },
  {
    title: 'Humanoid Robots',
    body: `Why shape robots like us? Because the world is shaped for us — door handles,
      stairs, valve wheels, vents. Modern humanoids fuse cameras, lidar and IMUs
      (your SCAN part), balance with whole-body model-predictive control, and
      increasingly run learned policies: networks trained in physics simulation,
      then transferred to the real machine ("sim-to-real").<br><br>
      AXIOM, VECTOR and PULSE are honest ancestors: sensors in, weights in the middle,
      motors out. You're not just wiring robots — you're writing policies.`,
  },
];
