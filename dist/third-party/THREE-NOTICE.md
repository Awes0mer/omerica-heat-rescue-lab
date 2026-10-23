# Three.js and upstream component notices

Three.js 0.186.1, copyright © 2010–2026 Three.js authors, is distributed under the [MIT license](THREE-LICENSE.txt). The two vendored build files are byte-for-byte originals from the official npm package. Heat Rescue has not changed these build files or copied any Three.js examples or asset packs. Their upstream source comments, including algorithm credits, remain intact.

The build contains an explicit copy of Earcut 3.0.2, and references or ports from other sources. The following notices are supplied alongside the upstream MIT license; they apply to the relevant upstream material and do not grant ownership of it to Heat Rescue.

| Component/reference in Three.js | Credit | Accompanying notice |
|---|---|---|
| Earcut 3.0.2 triangulation | Copyright (c) 2024 Mapbox | [ISC](THREE-EARCUT-LICENSE.txt) |
| Matrix inversion reference, gl-matrix | Brandon Jones and Colin MacKenzie IV | [MIT](THREE-GL-MATRIX-LICENSE.txt) |
| EventDispatcher | Copyright (c) 2011 Mr.doob | [MIT](THREE-EVENTDISPATCHER-LICENSE.txt) |
| ShapePath interior-point and reorientation ports, Paper.js | Jürg Lehni and Jonathan Puckey | [MIT](THREE-PAPER-LICENSE.txt) |
| Directional-light shadow calculation reference, lightgl.js | Copyright (C) 2011 Evan Wallace | [MIT](THREE-LIGHTGL-LICENSE.txt) |
| Ray-to-segment distance reference, Geometric Tools | David Eberly, copyright (c) 1998–2018 | [Boost Software License 1.0](THREE-BOOST-LICENSE.txt) |
| ACES fitting reference, ltc_code | Eric Heitz, Jonathan Dupuy, Stephen Hill and David Neubelt | [Permissive BSD-style notice with paper citation](THREE-LTC-LICENSE.txt) |
| AgX tone-mapping reference, Filament | Copyright (C) 2021 The Android Open Source Project | [Apache License 2.0](THREE-FILAMENT-LICENSE.txt) |

The ltc_code reference is *Real-Time Polygonal-Light Shading with Linearly Transformed Cosines*, Eric Heitz, Jonathan Dupuy, Stephen Hill and David Neubelt, ACM Transactions on Graphics (Proceedings of ACM SIGGRAPH 2016), 35(4), 2016. [Project page](https://eheitzresearch.wordpress.com/415-2/).

Three.js adapts Filament's AgX implementation into GLSL, including explicit output matrix generation and its own exposure handling; these adaptations are present in the upstream package, not changes by Heat Rescue. Filament in turn credits Troy Sobotka's AgX work and Blender. The contrast approximation credits [Benjamin Wrensch's minimal AgX implementation](https://iolite-engine.com/blog_posts/minimal_agx_implementation). These credits concern the renderer, not the thermoelectric model.

Other algorithm references retained verbatim inside upstream source comments include Christer Ericson's *Real-Time Collision Detection*, Eric Lengyel's tangent-space derivation, and the Catmull–Rom cubic-spline explanation by cfh ([original answer](https://stackoverflow.com/questions/9489736/catmull-rom-curve-with-no-cusps-and-no-self-intersections)). Heat Rescue redistributes the official Three.js implementation under its published license, not scans or copies of the referenced publications. A source citation by itself is not a license for the referenced publication or a separate grant for arbitrary code on that website.

The official package declares MIT and contains no separate root NOTICE file. This directory retains that license and supplies the above additional permissive notices for identified incorporated/reference code. The provenance manifest records exact notice URLs and hashes. This is a dependency and attribution record, not a warranty about every historical upstream contribution or a patent clearance opinion.
