# Three.js 0.170.0 and upstream component notices

The assembly renderer includes the original `build/three.module.js` from the official **three 0.170.0** npm package, associated with Three.js source commit `beab9e845f9e5ae11d648f55b24a0e910b56a85a` (r170). Its [MIT license](../vendor/three/LICENSE), copyright © 2010–2024 three.js authors, remains alongside the module. The module and license were compared byte for byte with the npm package. No renderer upgrade or modification is part of this notice update.

Three.js includes ports and references to other projects. The notices below preserve identified upstream attribution for the version actually distributed. Some credits appear in JavaScript comments; credits inside GLSL strings are removed by the upstream build, so the relevant source credits are supplied here. The copyright and permission notices apply to their respective upstream material.

| Material identified in r170 | Credit | Accompanying notice |
|---|---|---|
| Earcut **2.2.4** triangulation port | Copyright (c) 2016, Mapbox | [ISC](THREE-EARCUT-LICENSE.txt) |
| EventDispatcher reference | Copyright (c) 2011 Mr.doob | [MIT](THREE-EVENTDISPATCHER-LICENSE.txt) |
| CameraHelper frustum visualization reference, lightgl.js shadowmap example | Copyright (C) 2011 Evan Wallace | [MIT](THREE-LIGHTGL-LICENSE.txt) |
| Ray-to-segment distance and ray/triangle intersection references, Geometric Tools | David Eberly, copyright (c) 1998–2018 | [Boost Software License 1.0](THREE-BOOST-LICENSE.txt) |
| ACES fitting and rectangular-light shading references, ltc_code | Copyright (c) 2017 Eric Heitz, Jonathan Dupuy, Stephen Hill and David Neubelt | [BSD-style notice with paper citation](THREE-LTC-LICENSE.txt) |
| AgX tone-mapping implementation and physical-shading references, Filament | ToneMapper.cpp: Copyright (C) 2021 The Android Open Source Project | [Apache License 2.0](THREE-FILAMENT-LICENSE.txt) |
| Neutral tone-mapping reference from the model-viewer tone-mapping example | Emmett Lalish; example source: Copyright 2020 Google Inc. All Rights Reserved. | [Apache License 2.0](THREE-MODELVIEWER-LICENSE.txt) |

The ltc_code reference is *Real-Time Polygonal-Light Shading with Linearly Transformed Cosines*, Eric Heitz, Jonathan Dupuy, Stephen Hill and David Neubelt, ACM Transactions on Graphics (Proceedings of ACM SIGGRAPH 2016), 35(4), 2016. [Project page](https://eheitzresearch.wordpress.com/415-2/).

Three.js adapts Filament's AgX implementation into GLSL, explicitly generates an output matrix from Filament's inverse matrix, and adds its own exposure handling. These adaptations occur in the upstream Three.js source. Filament credits Troy Sobotka's AgX work; the r170 source identifies Filament's implementation as based on Blender's implementation using Rec.2020 primaries. The contrast approximation credits [Benjamin Wrensch's minimal AgX implementation](https://iolite-engine.com/blog_posts/minimal_agx_implementation). Three.js's NeutralToneMapping adapts the model-viewer example's CommerceToneMapping and adds exposure handling. Omerica Heat Rescue distributes the resulting Three.js build unchanged.

Other algorithm references retained in the upstream source include Christer Ericson's *Real-Time Collision Detection*, Eric Lengyel's tangent-space derivation, EuclideanSpace matrix/quaternion explanations, and the Catmull–Rom spline explanation by cfh ([original answer](https://stackoverflow.com/questions/9489736/catmull-rom-curve-with-no-cusps-and-no-self-intersections)). The r170 tone-mapping source also credits Reinhard's photographic tone reproduction paper, Jim Hejl and Richard Burgess-Dawson's filmic operator, and ITU-R BT.2407 color conversion matrices. These are source attributions, not permission to redistribute the referenced publications or unrelated website material.

The official three 0.170.0 package declares MIT and contains its root LICENSE, with no separate root NOTICE file. The additional notices here document identified incorporated or referenced material. Exact source URLs, versions, hashes, and audit scope are in [three-0.170.0-notice-provenance.json](three-0.170.0-notice-provenance.json). This record does not claim a complete historical contribution audit or patent clearance.
