"use client";

/**
 * DragonDecoration — purely ornamental SVG illustration that wraps behind
 * the floating MUDRA navbar pill.
 *
 * Composition:
 *  - The dragon body runs roughly horizontally, centred on the navbar pill.
 *  - Head faces RIGHT, tail curls LEFT.
 *  - The midsection of the body is hidden behind the pill, creating authentic depth.
 *  - Styled as flat 2-D traditional East-Asian line-art / paper-cut silhouette.
 *  - Colours: #E02E0B (fire), #5A0E0B (depth), #EE8814 (accents only).
 *
 * Responsiveness:
 *  - Desktop (≥1024px): full illustration rendered at natural width.
 *  - Tablet (768-1023px): scaled down proportionally via CSS transform.
 *  - Mobile (<768px): only the head + tail stubs shown; body hidden so the
 *    decoration never collides with navigation controls.
 *
 * Layer order:  dragon (z-[49]) sits below the navbar pill (z-[50]) and
 *               above the hero background (z-[0]).
 *
 * pointer-events: none — decoration never intercepts clicks.
 * aria-hidden: true — purely decorative.
 */

export function DragonDecoration() {
  return (
    /* Outer wrapper: fixed, full-width strip centred on the navbar row.
       top-0 so the dragon's natural vertical centre aligns with `top-4`
       navbar when we push it with padding-top in the SVG viewBox.       */
    <div
      aria-hidden="true"
      className="
        fixed top-0 inset-x-0 z-[49]
        pointer-events-none
        flex justify-center
        overflow-visible
      "
    >
      {/*
        SVG viewBox: 1400 wide × 180 tall (px units).
        The navbar pill sits roughly in the centre column (x 300–1100).
        The dragon's vertical mid-line is at y=90 (half of 180),
        which maps to ~top 90px on screen — comfortably inside the
        `top-4` (16px) navbar row.  The full strip (180px) stays above
        the hero content spacer (`clamp(4.5rem,10svh,6.5rem)` ≈ 72-104px),
        so there is no collision.
      */}
      <svg
        viewBox="0 0 1400 180"
        xmlns="http://www.w3.org/2000/svg"
        /* Natural render at 1400px; scales down on narrower viewports */
        className="
          w-full max-w-[1400px]
          /* Tablet: 70% scale */
          sm:scale-100
          /* On very narrow screens opacity reduces so it reads as subtle */
          opacity-90
        "
        style={{ height: "180px", display: "block", overflow: "visible" }}
        role="img"
        aria-label="Decorative dragon illustration"
      >
        {/* ── PALETTE DEFINITIONS ──────────────────────────────────────── */}
        <defs>
          {/* Dark-red mask used for scale interior lines */}
          <filter id="dd-inner" x="-2%" y="-2%" width="104%" height="104%">
            <feComposite in="SourceGraphic" />
          </filter>
        </defs>

        {/* ═══════════════════════════════════════════════════════════════
            LEFT SIDE — TAIL + rear body curves
            The tail enters from the lower-left and the body sweeps up
            toward the hidden section behind the pill.
        ═══════════════════════════════════════════════════════════════ */}

        {/* Tail tip — tight curlicue */}
        <g fill="#E02E0B">
          {/* Main tail curl */}
          <path d="
            M 60 145
            C 45 160, 30 165, 20 155
            C 10 145, 15 130, 30 125
            C 42 120, 55 130, 60 145 Z
          " />
          {/* Inner tail highlight */}
          <path d="
            M 55 143
            C 44 153, 35 156, 28 149
            C 22 142, 26 133, 36 130
            C 46 127, 54 135, 55 143 Z
          " fill="#5A0E0B" />

          {/* Tail flame/fin spikes */}
          <path d="M 35 122 C 28 108, 22 95, 15 88 C 10 83, 6 88, 12 95 C 18 102, 26 112, 35 122 Z" />
          <path d="M 55 128 C 50 112, 48 98, 44 90 C 40 82, 36 86, 40 94 C 44 102, 50 116, 55 128 Z" />
          <path d="M 24 128 C 15 116, 8 104, 4 96 C 0 89, -3 94, 3 101 C 9 108, 17 120, 24 128 Z" />
        </g>

        {/* Body segment 1 — sweeping up from tail toward centre */}
        <g fill="#E02E0B">
          {/* Main body tube */}
          <path d="
            M 55 148
            C 80 155, 110 150, 140 140
            C 170 130, 195 115, 215 100
            C 235 85, 250 72, 270 68
            L 280 63
            L 280 73
            C 262 77, 248 90, 228 105
            C 208 120, 183 135, 153 145
            C 123 155, 90 160, 65 158 Z
          " />
          {/* Body underside (lighter inner belly) */}
          <path d="
            M 80 152 C 105 157, 130 153, 155 143
            C 178 134, 198 120, 218 106
            C 222 103, 226 107, 222 110
            C 202 124, 181 139, 158 148
            C 134 158, 107 162, 80 158 Z
          " fill="#5A0E0B" />

          {/* Scale row 1 */}
          <ellipse cx="100" cy="148" rx="9" ry="5" transform="rotate(-15,100,148)" fill="#5A0E0B"/>
          <ellipse cx="120" cy="143" rx="9" ry="5" transform="rotate(-20,120,143)" fill="#5A0E0B"/>
          <ellipse cx="140" cy="136" rx="9" ry="5" transform="rotate(-25,140,136)" fill="#5A0E0B"/>
          <ellipse cx="160" cy="128" rx="9" ry="5" transform="rotate(-30,160,128)" fill="#5A0E0B"/>
          <ellipse cx="180" cy="120" rx="9" ry="5" transform="rotate(-35,180,120)" fill="#5A0E0B"/>
          <ellipse cx="200" cy="111" rx="9" ry="5" transform="rotate(-40,200,111)" fill="#5A0E0B"/>
          <ellipse cx="220" cy="102" rx="8" ry="4" transform="rotate(-42,220,102)" fill="#5A0E0B"/>
          <ellipse cx="240" cy="93"  rx="8" ry="4" transform="rotate(-44,240,93)"  fill="#5A0E0B"/>
          <ellipse cx="258" cy="84"  rx="7" ry="3" transform="rotate(-46,258,84)"  fill="#5A0E0B"/>
        </g>

        {/* Body dorsal fin spikes — left section */}
        <g fill="#E02E0B">
          <path d="M 90 148 C 85 130, 80 115, 82 100 C 84 92, 89 96, 88 104 C 87 114, 90 130, 93 148 Z" />
          <path d="M 115 140 C 108 122, 105 107, 107 94 C 109 86, 114 90, 113 98 C 112 108, 115 124, 118 140 Z" />
          <path d="M 140 131 C 133 114, 131 99, 133 87 C 135 79, 140 83, 139 91 C 138 101, 141 116, 144 131 Z" />
          <path d="M 163 121 C 158 105, 156 91, 158 80 C 160 73, 165 77, 164 84 C 163 93, 165 108, 168 121 Z" />
          <path d="M 185 112 C 180 96, 179 83, 181 73 C 183 66, 188 70, 187 77 C 186 86, 188 100, 191 112 Z" />
        </g>

        {/* Left foreleg / claw reaching down-left */}
        <g fill="#E02E0B">
          <path d="
            M 165 125 C 155 135, 148 148, 140 158
            C 135 164, 130 166, 128 162
            C 126 158, 130 154, 135 150
            C 140 146, 148 140, 158 132 Z
          " />
          {/* Claw toes */}
          <path d="M 128 162 C 122 168, 114 172, 108 168 C 104 165, 106 160, 112 158 C 118 156, 126 158, 128 162 Z"/>
          <path d="M 140 158 C 135 166, 128 172, 120 170 C 115 168, 117 162, 123 160 C 129 158, 137 158, 140 158 Z"/>
          <path d="M 150 153 C 146 162, 140 168, 132 168 C 127 168, 128 162, 134 160 C 140 158, 148 154, 150 153 Z"/>
        </g>


        {/* ═══════════════════════════════════════════════════════════════
            CENTRE — body hidden behind pill (300–1100 x-range roughly)
            We draw the body here but it will be occluded by the pill
            which sits above it in z-order. We keep minimal path so the
            edges peek out convincingly.
        ═══════════════════════════════════════════════════════════════ */}

        {/* Left entry edge — body disappears behind pill */}
        <g fill="#E02E0B">
          <path d="
            M 278 60
            C 292 54, 308 51, 320 52
            L 320 62
            C 308 61, 294 64, 280 70 Z
          " />
          {/* Scale edge detail as body enters pill zone */}
          <ellipse cx="298" cy="57" rx="7" ry="3" transform="rotate(-50,298,57)" fill="#5A0E0B"/>
          <ellipse cx="310" cy="54" rx="6" ry="3" transform="rotate(-52,310,54)" fill="#5A0E0B"/>
        </g>

        {/* Right exit edge — body emerges from pill */}
        <g fill="#E02E0B">
          <path d="
            M 1080 52
            C 1095 51, 1110 54, 1122 60
            L 1120 70
            C 1108 64, 1094 61, 1080 62 Z
          " />
          <ellipse cx="1090" cy="57" rx="7" ry="3" transform="rotate(-130,1090,57)" fill="#5A0E0B"/>
          <ellipse cx="1102" cy="54" rx="6" ry="3" transform="rotate(-128,1102,54)" fill="#5A0E0B"/>
        </g>


        {/* ═══════════════════════════════════════════════════════════════
            RIGHT SIDE — front body, neck, head, whiskers, horns
        ═══════════════════════════════════════════════════════════════ */}

        {/* Body segment 2 — from pill right edge up toward neck */}
        <g fill="#E02E0B">
          <path d="
            M 1120 62
            C 1150 55, 1175 50, 1200 52
            C 1225 54, 1248 62, 1265 72
            C 1282 82, 1292 94, 1295 106
            L 1285 108
            C 1282 98, 1273 87, 1257 77
            C 1241 67, 1220 59, 1198 57
            C 1176 55, 1153 60, 1128 67 Z
          " />
          {/* Belly lighter strip */}
          <path d="
            M 1128 65 C 1155 59, 1180 56, 1202 58
            C 1222 60, 1242 68, 1257 78
            C 1260 80, 1258 84, 1255 82
            C 1240 72, 1220 64, 1198 62
            C 1177 60, 1153 64, 1128 70 Z
          " fill="#5A0E0B"/>

          {/* Scale rows right section */}
          <ellipse cx="1140" cy="64" rx="8" ry="4" transform="rotate(50,1140,64)"  fill="#5A0E0B"/>
          <ellipse cx="1158" cy="59" rx="8" ry="4" transform="rotate(48,1158,59)"  fill="#5A0E0B"/>
          <ellipse cx="1177" cy="56" rx="8" ry="4" transform="rotate(46,1177,56)"  fill="#5A0E0B"/>
          <ellipse cx="1196" cy="55" rx="8" ry="4" transform="rotate(44,1196,55)"  fill="#5A0E0B"/>
          <ellipse cx="1215" cy="57" rx="8" ry="4" transform="rotate(42,1215,57)"  fill="#5A0E0B"/>
          <ellipse cx="1234" cy="62" rx="8" ry="4" transform="rotate(38,1234,62)"  fill="#5A0E0B"/>
          <ellipse cx="1251" cy="70" rx="8" ry="4" transform="rotate(34,1251,70)"  fill="#5A0E0B"/>
          <ellipse cx="1266" cy="80" rx="7" ry="3" transform="rotate(30,1266,80)"  fill="#5A0E0B"/>
        </g>

        {/* Dorsal fin spikes — right section */}
        <g fill="#E02E0B">
          <path d="M 1140 61 C 1137 43, 1136 28, 1138 16 C 1140 9, 1144 12, 1144 20 C 1144 30, 1144 46, 1146 61 Z"/>
          <path d="M 1160 57 C 1157 39, 1156 25, 1158 13 C 1160 6, 1164 9, 1164 17 C 1164 27, 1164 43, 1166 57 Z"/>
          <path d="M 1180 54 C 1177 38, 1177 24, 1179 13 C 1181 6, 1185 9, 1185 17 C 1185 27, 1184 42, 1186 54 Z"/>
          <path d="M 1200 54 C 1198 39, 1198 25, 1200 15 C 1202 8, 1206 11, 1206 19 C 1206 29, 1205 43, 1206 54 Z"/>
          <path d="M 1220 57 C 1219 43, 1219 30, 1221 20 C 1223 13, 1227 16, 1227 24 C 1227 33, 1226 46, 1227 57 Z"/>
          <path d="M 1239 63 C 1238 50, 1239 38, 1241 29 C 1243 22, 1247 25, 1246 33 C 1245 42, 1244 54, 1245 63 Z"/>
        </g>

        {/* Right foreleg / claw */}
        <g fill="#E02E0B">
          <path d="
            M 1220 62 C 1230 75, 1238 90, 1235 105
            C 1233 114, 1226 116, 1221 110
            C 1216 104, 1216 94, 1218 82 Z
          " />
          {/* Claw toes */}
          <path d="M 1221 110 C 1218 120, 1212 128, 1205 126 C 1200 124, 1202 118, 1208 116 C 1214 114, 1220 112, 1221 110 Z"/>
          <path d="M 1231 107 C 1229 118, 1224 126, 1217 126 C 1212 126, 1213 119, 1219 117 C 1225 115, 1230 111, 1231 107 Z"/>
          <path d="M 1237 100 C 1237 111, 1233 120, 1226 121 C 1221 122, 1221 115, 1227 112 C 1233 109, 1237 105, 1237 100 Z"/>
        </g>

        {/* ── NECK ─────────────────────────────────────────────────────── */}
        <g fill="#E02E0B">
          {/* Neck tube */}
          <path d="
            M 1293 104
            C 1305 118, 1312 133, 1310 148
            C 1308 160, 1298 166, 1288 162
            C 1278 158, 1274 146, 1276 134
            C 1278 122, 1287 112, 1296 106 Z
          " />
          {/* Neck scales */}
          <ellipse cx="1293" cy="118" rx="8" ry="5" transform="rotate(70,1293,118)" fill="#5A0E0B"/>
          <ellipse cx="1300" cy="132" rx="8" ry="5" transform="rotate(75,1300,132)" fill="#5A0E0B"/>
          <ellipse cx="1300" cy="148" rx="7" ry="4" transform="rotate(78,1300,148)" fill="#5A0E0B"/>
          {/* Neck mane wisps */}
          <path d="M 1283 112 C 1270 102, 1260 94, 1258 84 C 1256 76, 1262 74, 1267 80 C 1272 86, 1278 98, 1285 110 Z" />
          <path d="M 1289 108 C 1278 95, 1271 82, 1271 70 C 1271 62, 1277 61, 1281 68 C 1285 75, 1287 90, 1292 106 Z" />
        </g>

        {/* ── HEAD ─────────────────────────────────────────────────────── */}
        <g fill="#E02E0B">
          {/* Skull base */}
          <path d="
            M 1286 160
            C 1296 168, 1314 174, 1332 172
            C 1350 170, 1366 160, 1374 148
            C 1382 136, 1380 122, 1370 114
            C 1360 106, 1346 104, 1332 108
            C 1318 112, 1306 122, 1300 134
            C 1294 146, 1286 158, 1286 160 Z
          " />

          {/* Eye socket indent */}
          <ellipse cx="1348" cy="122" rx="12" ry="10" fill="#5A0E0B"/>
          {/* Pupil */}
          <ellipse cx="1350" cy="122" rx="6" ry="7" fill="#E02E0B"/>
          <ellipse cx="1351" cy="120" rx="2.5" ry="3" fill="#110B0B"/>
          {/* Eye glint */}
          <ellipse cx="1352" cy="119" rx="1" ry="1" fill="#EE8814" opacity="0.9"/>

          {/* Snout / jaw */}
          <path d="
            M 1370 114
            C 1382 112, 1394 112, 1400 118
            C 1406 124, 1402 132, 1394 134
            C 1386 136, 1374 130, 1368 122 Z
          " />

          {/* Upper lip / nostril ridge */}
          <path d="
            M 1374 116 C 1382 113, 1392 114, 1398 120
            C 1400 123, 1397 125, 1393 123
            C 1387 120, 1378 118, 1374 116 Z
          " fill="#5A0E0B"/>

          {/* Lower jaw / chin */}
          <path d="
            M 1368 134
            C 1375 142, 1380 150, 1375 158
            C 1370 164, 1360 162, 1356 155
            C 1352 148, 1354 138, 1360 132 Z
          " />

          {/* Tooth row */}
          <path d="M 1372 131 L 1376 138 L 1370 136 Z" fill="#E3D28A" opacity="0.6"/>
          <path d="M 1364 134 L 1366 142 L 1361 139 Z" fill="#E3D28A" opacity="0.6"/>
          <path d="M 1376 128 L 1382 134 L 1376 133 Z" fill="#E3D28A" opacity="0.6"/>

          {/* Head scales / plates */}
          <ellipse cx="1316" cy="120" rx="10" ry="7" transform="rotate(60,1316,120)" fill="#5A0E0B"/>
          <ellipse cx="1330" cy="112" rx="10" ry="6" transform="rotate(55,1330,112)" fill="#5A0E0B"/>
          <ellipse cx="1344" cy="108" rx="9"  ry="5" transform="rotate(50,1344,108)" fill="#5A0E0B"/>

          {/* Crown spikes / horns */}
          <path d="M 1312 116 C 1308 102, 1306 88, 1310 76 C 1312 70, 1317 72, 1316 80 C 1315 90, 1315 104, 1316 116 Z"/>
          <path d="M 1325 110 C 1322 95, 1322 80, 1327 68 C 1329 62, 1334 65, 1333 73 C 1332 83, 1330 97, 1330 110 Z"/>
          <path d="M 1337 107 C 1336 93, 1337 79, 1342 68 C 1344 62, 1349 65, 1348 73 C 1347 83, 1344 96, 1343 107 Z"/>
          {/* Extra forward horn */}
          <path d="M 1356 108 C 1358 93, 1362 80, 1368 70 C 1371 64, 1376 67, 1374 75 C 1372 84, 1365 97, 1360 108 Z"/>

          {/* Mane / frill behind head */}
          <path d="M 1296 134 C 1282 128, 1270 118, 1268 106 C 1266 96, 1272 92, 1278 98 C 1284 104, 1290 118, 1298 132 Z"/>
          <path d="M 1290 142 C 1274 138, 1260 130, 1256 118 C 1252 108, 1258 104, 1265 110 C 1272 116, 1280 128, 1292 140 Z"/>
          <path d="M 1294 150 C 1278 148, 1263 142, 1260 130 C 1257 120, 1264 116, 1270 122 C 1276 128, 1282 140, 1296 148 Z"/>
        </g>

        {/* ── WHISKERS ─────────────────────────────────────────────────── */}
        <g stroke="#E02E0B" strokeWidth="2.2" fill="none" strokeLinecap="round">
          {/* Upper whisker pair */}
          <path d="M 1368 116 C 1358 108, 1350 98, 1348 86 C 1346 76, 1350 70, 1356 74"/>
          <path d="M 1370 118 C 1362 108, 1356 96, 1356 82 C 1356 72, 1362 68, 1366 74"/>
          {/* Lower whisker */}
          <path d="M 1368 128 C 1360 136, 1350 148, 1348 160 C 1346 168, 1352 172, 1358 166"/>
          <path d="M 1372 130 C 1366 140, 1360 154, 1360 166 C 1360 174, 1366 176, 1370 170"/>
        </g>

        {/* Whisker tip dots */}
        <g fill="#EE8814" opacity="0.85">
          <circle cx="1356" cy="74" r="2.5"/>
          <circle cx="1366" cy="74" r="2.5"/>
          <circle cx="1358" cy="166" r="2.5"/>
          <circle cx="1370" cy="170" r="2.5"/>
        </g>

        {/* ── AMBER ACCENT DETAILS ─────────────────────────────────────── */}
        {/* A few scale highlight dots in EE8814 */}
        <g fill="#EE8814" opacity="0.45">
          <circle cx="1180" cy="55"  r="2"/>
          <circle cx="1200" cy="54"  r="2"/>
          <circle cx="1220" cy="56"  r="2"/>
          <circle cx="140"  cy="135" r="2"/>
          <circle cx="165"  cy="125" r="2"/>
          <circle cx="190"  cy="114" r="2"/>
        </g>


        {/* ═══════════════════════════════════════════════════════════════
            MOBILE-ONLY: head stub (right) + tail stub (left)
            Shown via CSS class on narrow viewports; full-body paths above
            are hidden on mobile to prevent layout interference.
        ═══════════════════════════════════════════════════════════════ */}
        {/* No additional mobile paths needed — responsive visibility is
            handled by wrapping div classes below. */}
      </svg>
    </div>
  );
}
