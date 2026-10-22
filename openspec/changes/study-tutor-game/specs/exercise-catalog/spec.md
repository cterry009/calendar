## ADDED Requirements

### Requirement: Parse section exercises
The system SHALL read every `**🟢 Sencillo.**` and `**🟡 Medio.**` exercise of a note into an `Exercise`
with kind `sencillo` (b₀ = −1) or `medio` (b₀ = 0), the section it belongs to, its statement and its
answer. A section is a `## N. ...` heading, or a `### N. ...` heading inside `## Desarrollo`; `###`
subsections inside a numbered `##` section don't start a new section. Any other `##` heading ends the
current section, and exercises outside a section are ignored.

#### Scenario: Green and yellow exercises in a numbered section
- **WHEN** `AN1_analisis_real.md` has `## 3. Sucesiones y series en $\mathbb{R}$` followed by a 🟢 and a 🟡 exercise
- **THEN** the parser returns `AN1#3#1` (kind `sencillo`, b₀ −1) and `AN1#3#2` (kind `medio`, b₀ 0), both with section `3` and note code `AN1`

#### Scenario: Pillar note with sections under Desarrollo
- **WHEN** a note has `## Desarrollo` and, inside it, `### 4. Clustering` with a 🟢 exercise
- **THEN** the exercise gets section `4`

#### Scenario: Subsection inside a numbered section
- **WHEN** `## 1. Los números reales` contains `### 1.4 Consecuencias` with a 🟡 exercise
- **THEN** the exercise is in section `1`

#### Scenario: Exercise outside any section
- **WHEN** a 🟢 marker appears under `## Cómo usar los ejercicios de esta nota`
- **THEN** it is not returned

### Requirement: Statement and answer are separated
The statement SHALL run from the text after the marker up to the first callout, without the
`*(tu respuesta aquí)*` or `*(tu intento aquí)*` placeholder, trimmed. The answer SHALL be the body of
the `> [!success]-` callout (Respuesta or Solución) without the leading `> `, or null if there is none.
LaTeX and markdown SHALL be kept unchanged.

#### Scenario: Multi-line answer with LaTeX
- **WHEN** an exercise's statement contains `$\sup A$` and its Respuesta callout has two `> ` lines
- **THEN** the statement contains `$\sup A$` unchanged and no placeholder, and the answer is the two lines without `> `

### Requirement: Parse true/false callouts
Each `> [!question]- Verdadero o falso (...)` callout inside a section SHALL become one exercise of kind
`vf` (b₀ = −1.5). Its statement SHALL be the numbered claims with the verdict cut off (from
` — **Verdadero` or ` — **Falso`), and its answer the full callout body.

#### Scenario: Five claims in one callout
- **WHEN** section 1 has a true/false callout with five claims after a 🟢 and two 🟡
- **THEN** it is returned as one exercise `AN1#1#4` of kind `vf`, whose statement lists the five claims without "Verdadero"/"Falso" and whose answer contains them

### Requirement: Parse closing exercises
Each closing item SHALL become an exercise. Under `## Cierre — 🔴 Difícil` and
`## Cierre — ⚫ Muy difícil`, each item `**<label>.**` or `**<label> (<title>).**` (label like `D1` or
`M2`) becomes an exercise of kind `dificil` (b₀ = +1,
section `cierre-rojo`) or `muy_dificil` (b₀ = +2, section `cierre-negro`), with the title (or null), the
statement, the `> [!tip]- Pista` body as hint and the `> [!success]- Solución` body as answer.

#### Scenario: Red closing with title, hint and solution
- **WHEN** the 🔴 closing has `**D2 (Picard-Lindelöf).** Sea $f$ ...` with a Pista and a Solución
- **THEN** the parser returns `AN1#cierre-rojo#D2`, kind `dificil`, b₀ 1, title `Picard-Lindelöf`, with the hint and the answer separated from the statement

#### Scenario: Black closing without title
- **WHEN** the ⚫ closing has `**M1.** Prueba que ...`
- **THEN** the parser returns `<code>#cierre-negro#M1` with kind `muy_dificil`, b₀ 2 and title null

### Requirement: Stable ids and order
Ids SHALL be `${noteCode}#${section}#${n}` for section exercises (n counts 🟢, 🟡 and true/false together
in order of appearance within the section, from 1) and `${noteCode}#cierre-rojo|cierre-negro#${label}`
for closings. The note code SHALL be the file name's prefix before the first `_`. `order` SHALL be the
position in the note. Parsing the same text twice SHALL give the same ids.

#### Scenario: Re-parse
- **WHEN** the same note is parsed twice
- **THEN** both results are equal

### Requirement: Real notes
The parser SHALL extract 20 🟢 and 32 🟡 exercises from the real `AN1_analisis_real.md`. The test for it
SHALL be skipped when the vault path (`CALENDAR_VAULT` or the default) doesn't exist.

#### Scenario: AN1 in the vault
- **WHEN** the vault is present and AN1 is parsed
- **THEN** it yields 20 `sencillo` and 32 `medio` exercises
