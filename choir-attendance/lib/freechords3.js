// A third batch of public-domain Catholic hymns, carols, Mass parts (Latin chant) and children's songs (November 2026).
// Chosen for a Catholic parish choir: Eucharistic, Marian, seasonal and Mass-part music sung in Catholic churches.
// Words and tunes are old enough to be free for anyone to use, in India and elsewhere. Chords are simple and
// common: check them against your own hymn book. This batch also goes straight into the Chord Book and, as words
// only, into the hymn list (once, see addNewSongs in server.js).
const S = (id, title, key, category, body, kind = 'hymn') => ({ id, title, key, kind, category, body: body.trim() });

export const NOV_2026_BATCH = 'nov2026';
export const CATHOLIC_BATCH = 'nov2026-catholic';
// Songs from the first version of this batch that are not Catholic church music. They are taken out of the Chord Book and
// the hymn list again, but only where they are still exactly as they were added (no recording, notes unchanged).
export const REMOVED_TITLES = ['Here We Come A-wassailing', 'Jolly Old Saint Nicholas', "The Church's One Foundation", 'To God Be the Glory', 'Count Your Blessings', 'Shall We Gather at the River', 'Leaning on the Everlasting Arms', 'Sweet Hour of Prayer', 'Jesus Wants Me for a Sunbeam', 'O How I Love Jesus', 'Down by the Riverside', 'Do, Lord'];

export const NEW_CHORDS = [
  // ---- Christmas and Advent ----
  S('good-christian-men', 'Good Christian Men, Rejoice', 'F', 'Christmas', `
{Verse 1}
Good [F]Christian men, re[C]joice
With [F]heart and soul and [C]voice;
[F]Give ye heed to [Bb]what we [F]say:
[C]News! [F]News!
Jesus Christ is [C]born to[F]day!
Ox and ass be[Bb]fore Him [F]bow,
And [Bb]He is in the [F]manger now.
[C]Christ is born to[F]day! [C]Christ is born to[F]day!
{Verse 2}
Good [F]Christian men, re[C]joice
With [F]heart and soul and [C]voice;
[F]Now ye hear of [Bb]endless [F]bliss:
[C]Joy! [F]Joy!
Jesus Christ was [C]born for [F]this!
He hath oped the [Bb]heavenly [F]door,
And [Bb]man is blessed ever[F]more.
[C]Christ was born for [F]this! [C]Christ was born for [F]this!`),

  S('angels-from-the-realms', 'Angels from the Realms of Glory', 'G', 'Christmas', `
{Verse 1}
[G]Angels, from the [D]realms of [G]glory,
[C]Wing your [G]flight o'er [D]all the [G]earth;
Ye who sang cre[D]ation's [G]story
[C]Now pro[G]claim Mes[D]siah's [G]birth.
{Chorus}
[D]Come and [G]worship, [D]come and [G]worship,
[C]Worship [G]Christ, the [D]newborn [G]King.
{Verse 2}
[G]Shepherds, in the [D]fields a[G]biding,
[C]Watching [G]o'er your [D]flocks by [G]night,
God with man is [D]now re[G]siding;
[C]Yonder [G]shines the [D]infant [G]light.`),

  S('in-the-bleak-midwinter', 'In the Bleak Midwinter', 'F', 'Christmas', `
{Verse 1}
[F]In the bleak mid[Gm]winter, [C]frosty wind made [F]moan,
Earth stood hard as [Gm]iron, [C]water like a [F]stone;
[Dm]Snow had fallen, [Am]snow on snow, [Bb]snow on [C]snow,
[F]In the bleak mid[Gm]winter, [C]long a[F]go.
{Last verse}
[F]What can I give [Gm]Him, [C]poor as I [F]am?
If I were a [Gm]shepherd, [C]I would bring a [F]lamb;
[Dm]If I were a [Am]wise man, [Bb]I would do my [C]part;
[F]Yet what I can I [Gm]give Him: [C]give my [F]heart.`),

  S('of-the-fathers-love', "Of the Father's Love Begotten", 'D', 'Christmas', `
{Verse 1}
[D]Of the Father's [G]love be[D]gotten,
Ere the [A]worlds be[D]gan to be,
He is [G]Alpha [D]and O[A]mega,
[D]He the source, the [G]ending [A]He,
[D]Of the things that [G]are, that [D]have been,
And that [Bm]future [G]years shall [A]see,
[D]Ever[G]more and [A]ever[D]more!`),

  S('infant-holy', 'Infant Holy, Infant Lowly', 'G', 'Christmas', `
{Verse 1}
[G]Infant holy, [D]infant [G]lowly,
For His [C]bed a [G]cattle [D]stall;
[G]Oxen lowing, [D]little [G]knowing
Christ the [C]babe is [D]Lord of [G]all.
[G]Swift are [C]winging [G]angels [D]singing,
[G]Nowells [C]ringing, [G]tidings [D]bringing:
[G]Christ the [C]babe is [D]Lord of [G]all.
{Verse 2}
[G]Flocks were sleeping, [D]shepherds [G]keeping
Vigil [C]till the [G]morning [D]new
[G]Saw the glory, [D]heard the [G]story,
Tidings [C]of a [D]gospel [G]true.
[G]Thus re[C]joicing, [G]free from [D]sorrow,
[G]Praises [C]voicing, [G]greet the [D]morrow:
[G]Christ the [C]babe was [D]born for [G]you.`),

  S('il-est-ne', 'Il est né, le divin Enfant', 'F', 'Christmas', `
{Chorus}
[F]Il est né, le di[C]vin En[F]fant,
Jouez haut[Bb]bois, ré[F]sonnez mu[C]settes!
[F]Il est né, le di[C]vin En[F]fant,
Chantons [Bb]tous son a[C]vène[F]ment!
{Verse 1}
[F]Depuis plus de [C]quatre mille [F]ans,
Nous le prom[C]ettaient les pro[F]phètes;
[F]Depuis plus de [C]quatre mille [F]ans,
Nous at[Bb]tendions cet [C]heureux [F]temps.`),

  S('love-came-down', 'Love Came Down at Christmas', 'F', 'Christmas', `
{Verse 1}
[F]Love came down at [Bb]Christmas,
[F]Love all lovely, [C]Love Divine;
[F]Love was born at [Bb]Christmas,
[F]Star and angels [C]gave the [F]sign.
{Verse 2}
[F]Worship we the [Bb]Godhead,
[F]Love Incarnate, [C]Love Divine;
[F]Worship we our [Bb]Jesus,
[F]But wherewith for [C]sacred [F]sign?
{Verse 3}
[F]Love shall be our [Bb]token,
[F]Love be yours and [C]love be mine,
[F]Love to God and [Bb]all men,
[F]Love for plea and [C]gift and [F]sign.`),

  S('lo-how-a-rose', "Lo, How a Rose E'er Blooming", 'F', 'Advent', `
{Verse 1}
[F]Lo, how a [C]Rose e'er [Dm]bloom[F]ing
From [Bb]tender [F]stem hath [C]sprung!
[F]Of Jesse's [C]lineage [Dm]com[F]ing,
As [Bb]men of [F]old have [C]sung.
It [F]came, a [Bb]floweret [F]bright,
A[Dm]mid the cold of [Bb]win[C]ter,
When [F]half-spent [C]was the [F]night.
{Verse 2}
[F]Isaiah [C]'twas fore[Dm]told [F]it,
The [Bb]Rose I [F]have in [C]mind;
[F]With Mary [C]we be[Dm]hold [F]it,
The [Bb]virgin [F]mother [C]kind.
To [F]show God's [Bb]love a[F]right,
She [Dm]bore to us a [Bb]Sav[C]iour,
When [F]half-spent [C]was the [F]night.`),

  S('on-jordans-bank', "On Jordan's Bank", 'G', 'Advent', `
{Verse 1}
On [G]Jordan's bank the [D]Baptist's [G]cry
An[C]nounces [G]that the [D]Lord is [G]nigh;
A[Em]wake and [C]hearken, [D]for He [G]brings
Glad [C]tidings [G]of the [D]King of [G]kings.
{Verse 2}
Then [G]cleansed be every [D]breast from [G]sin;
Make [C]straight the [G]way for [D]God with[G]in;
Pre[Em]pare we [C]in our [D]hearts a [G]home
Where [C]such a [G]mighty [D]guest may [G]come.`),

  // ---- Entrance and praise ----
  S('praise-my-soul', 'Praise, My Soul, the King of Heaven', 'D', 'Entrance', `
{Verse 1}
[D]Praise, my soul, the [A]King of [D]heaven;
[G]To His [D]feet thy [A]tribute [D]bring;
[D]Ransomed, healed, re[A]stored, for[Bm]given,
[G]Who like [D]me His [E]praise should [A]sing?
[D]Alle[G]luia! [D]Alle[A]luia!
[G]Praise the [D]ever[A]lasting [D]King.
{Verse 2}
[D]Praise Him for His [A]grace and [D]favour
[G]To our [D]fathers [A]in dis[D]tress;
[D]Praise Him still the [A]same for [Bm]ever,
[G]Slow to [D]chide, and [E]swift to [A]bless.
[D]Alle[G]luia! [D]Alle[A]luia!
[G]Glorious [D]in His [A]faithful[D]ness.`),

  S('all-things-bright', 'All Things Bright and Beautiful', 'F', 'Children', `
{Chorus}
[F]All things bright and [C]beauti[F]ful,
[Bb]All creatures [F]great and [C]small,
[F]All things wise and [C]wonder[F]ful,
The [Bb]Lord God [C]made them [F]all.
{Verse 1}
[F]Each little flower that [C]opens,
[F]Each little bird that [C]sings,
He [F]made their glowing [Bb]colours,
He [F]made their [C]tiny [F]wings.
{Verse 2}
The [F]purple-headed [C]mountain,
The [F]river running [C]by,
The [F]sunset and the [Bb]morning
That [F]brightens [C]up the [F]sky.`),

  S('lead-kindly-light', 'Lead, Kindly Light', 'D', 'Recessional', `
{Verse 1}
[D]Lead, kindly [G]Light, a[D]mid the en[A]circling [D]gloom,
Lead [G]Thou me [A]on;
The [D]night is [G]dark, and [D]I am [A]far from [D]home;
Lead [G]Thou me [A]on.
[D]Keep Thou my [G]feet; I [D]do not [A]ask to [Bm]see
The [G]distant [D]scene; one [A]step e[D]nough for [A]me.`),

  // ---- Lent and Easter ----
  S('all-glory-laud', 'All Glory, Laud and Honour', 'C', 'Lent', `
{Chorus}
[C]All glory, laud and [G]hon[C]our
To [F]Thee, Re[C]deemer, [G]King,
To [C]whom the lips of [Am]chil[F]dren
Made [C]sweet ho[G]sannas [C]ring.
{Verse 1}
[C]Thou art the King of [G]Is[C]rael,
Thou [F]David's [C]royal [G]Son,
Who [C]in the Lord's name [Am]com[F]est,
The [C]King and [G]Blessed [C]One.`),

  S('were-you-there', 'Were You There', 'D', 'Lent', `
{Verse 1}
[D]Were you there when they [G]crucified my [D]Lord?
Were you there when they [Bm]crucified my [A]Lord?
[D]Oh! [D7]Sometimes it [G]causes me to [Gm]tremble, [D]tremble, [Bm]tremble.
[D]Were you there when they [A]crucified my [D]Lord?
{Verse 2}
[D]Were you there when they [G]laid Him in the [D]tomb?
Were you there when they [Bm]laid Him in the [A]tomb?
[D]Oh! [D7]Sometimes it [G]causes me to [Gm]tremble, [D]tremble, [Bm]tremble.
[D]Were you there when they [A]laid Him in the [D]tomb?`, 'song'),

  S('the-strife-is-oer', "The Strife Is O'er", 'D', 'Easter', `
{Intro}
[D]Alle[G]luia! [D]Alle[A]luia! [D]Alle[G]lu[A]i[D]a!
{Verse 1}
The [D]strife is o'er, the [A]battle [D]done;
The [D]victory of [G]life is [A]won;
The [D]song of [G]triumph [D]has be[A]gun.
[D]Alle[G]lu[A]i[D]a!
{Verse 2}
The [D]powers of death have [A]done their [D]worst,
But [D]Christ their le[G]gions hath dis[A]persed:
Let [D]shouts of [G]holy [D]joy out[A]burst.
[D]Alle[G]lu[A]i[D]a!`),

  S('thine-be-the-glory', 'Thine Be the Glory', 'D', 'Easter', `
{Chorus}
[D]Thine be the [A]glory, [D]risen, [G]conquering [A]Son;
[D]Endless is the [G]victory [D]Thou o'er [A]death hast [D]won.
{Verse 1}
[D]Angels in bright [A]raiment [D]rolled the [G]stone a[A]way,
[D]Kept the folded [G]grave-clothes [D]where Thy [A]body [D]lay.`),

  // ---- Communion ----
  S('sweet-sacrament-divine', 'Sweet Sacrament Divine', 'F', 'Communion', `
{Verse 1}
[F]Sweet Sacrament di[C]vine,
Hid [F]in Thine earthly [C]home;
Lo, [F]round Thy lowly [Bb]shrine,
With [F]suppliant [C]hearts we [F]come;
[Bb]Jesus, to Thee our [F]voice we raise
In [Bb]songs of love and [C]heartfelt praise.
[F]Sweet Sacra[Bb]ment di[F]vine,
[F]Sweet Sacra[C]ment di[F]vine.`),

  S('soul-of-my-saviour', 'Soul of My Saviour', 'G', 'Communion', `
{Verse 1}
[G]Soul of my Saviour, [C]sanctify my [G]breast;
[G]Body of Christ, be [A]Thou my saving [D]guest;
[G]Blood of my Saviour, [C]bathe me in Thy [G]tide,
[C]Wash me with [G]water [D]flowing from Thy [G]side.
{Verse 2}
[G]Strength and protection [C]may Thy Passion [G]be;
[G]O blessed Jesus, [A]hear and answer [D]me;
[G]Deep in Thy wounds, Lord, [C]hide and shelter [G]me;
[C]So shall I [G]never, [D]never part from [G]Thee.`),

  S('panis-angelicus', 'Panis Angelicus', 'G', 'Communion', `
{Verse}
[G]Panis an[C]geli[G]cus
Fit [D]panis [G]homi[D]num;
[G]Dat panis [C]caeli[G]cus
Fi[Em]guris [A]termi[D]num:
O [G]res mi[C]rabi[G]lis!
Man[Em]ducat [C]Domi[D]num
[G]Pauper, [Em]pauper, [C]servus et [D]humi[G]lis.`),

  S('ave-verum-corpus', 'Ave Verum Corpus', 'D', 'Communion', `
{Verse}
[D]Ave, [A]ave [D]verum [A]corpus,
[D]natum de [G]Maria [A]Virgine,
[D]vere [G]passum, [D]immo[A]latum
[Bm]in cruce [G]pro ho[A]mine,
[D]cuius [G]latus [D]perfo[A]ratum
[D]fluxit [G]aqua et [A]sanguine:
[G]esto [D]nobis [Em]prae[A]gustatum
[D]in [G]mortis [A]exa[D]mine.`),

  S('adoro-te-devote', 'Adoro Te Devote', 'D', 'Communion', `
{Verse 1}
A[D]doro te de[G]vote, [D]latens [A]Deitas,
[D]Quae sub his fi[G]guris [D]vere [A]lati[D]tas:
[G]Tibi se cor [D]meum [A]totum [Bm]subicit,
[G]Quia te con[D]templans [A]totum de[D]ficit.`),

  // ---- Our Lady ----
  S('ave-maria-chant', 'Ave Maria (chant)', 'D', 'Marian', `
{Verse}
[D]Ave Mari[G]a, [D]gratia [A]plena,
[D]Dominus [G]tecum, bene[A]dicta tu in [D]mulieribus,
et bene[G]dictus [D]fructus [Bm]ventris tu[A]i, Jesus.
[D]Sancta Mari[G]a, [D]Mater [A]Dei,
[G]ora pro [D]nobis pecca[A]toribus,
[D]nunc et in [G]hora [D]mortis [A]nostrae. [D]Amen.`),

  S('salve-regina', 'Salve Regina', 'F', 'Marian', `
{Verse}
[F]Salve, Re[C]gina, [F]mater miseri[C]cordiae,
[F]vita, dul[Bb]cedo, et [F]spes [C]nostra, [F]salve.
[F]Ad te cla[Bb]mamus, [F]exsules [C]filii Hevae.
[F]Ad te sus[Bb]piramus, [F]gementes et [C]flentes
in [Dm]hac lacri[Bb]marum [C]valle.
[F]Eia, ergo, [Bb]advocata [F]nostra,
illos [Bb]tuos miseri[F]cordes [C]oculos ad nos con[F]verte.
Et [F]Jesum, bene[Bb]dictum [F]fructum ventris [C]tui,
[F]nobis post hoc ex[Bb]silium [C]osten[F]de.
O [Bb]clemens, O [F]pia, O [Bb]dulcis [C]Virgo Ma[F]ria.`),

  S('o-sanctissima', 'O Sanctissima', 'F', 'Marian', `
{Verse 1}
[F]O sanctissima, [C]O pi[F]issima,
[Bb]Dulcis [F]Virgo Ma[C]ri[F]a!
[F]Mater amata, [C]intemer[F]ata,
[Bb]Ora, [F]ora [C]pro [F]nobis.`),

  S('regina-caeli', 'Regina Caeli', 'G', 'Marian', `
{Verse}
[G]Regina caeli, [C]lae[G]tare, [D]alle[G]luia;
[G]Quia quem me[C]ruisti [G]portare, [D]alle[G]luia;
[Em]Resurrexit [C]sicut [G]dixit, [D]alle[G]luia;
[G]Ora pro [C]nobis [G]Deum, [D]alle[G]luia.`),

  // ---- Mass parts in Latin (the old chant settings; the Latin words are free for anyone to use) ----
  S('kyrie-chant', 'Kyrie Eleison (chant)', 'D', 'LHM', `
{Kyrie}
[D]Kyrie, e[G]le[D]ison. [A]Kyrie, e[D]leison.
{Christe}
[D]Christe, e[G]le[D]ison. [A]Christe, e[D]leison.
{Kyrie}
[D]Kyrie, e[G]le[D]ison. [A]Kyrie, e[G]lei[D]son.`),

  S('gloria-de-angelis', 'Gloria (Missa de Angelis)', 'D', 'Gloria', `
{Gloria}
[D]Gloria in ex[A]celsis [D]Deo.
Et in [G]terra pax [D]hominibus [A]bonae volun[D]tatis.
[D]Laudamus te. [A]Benedicimus te.
[D]Adoramus te. [G]Glorifi[A]camus [D]te.
[D]Gratias agimus tibi propter [A]magnam gloriam [D]tuam.
Domine [G]Deus, Rex cae[D]lestis, Deus [A]Pater omni[D]potens.
[D]Domine Fili uni[A]genite, Jesu [D]Christe.
Domine [G]Deus, Agnus [D]Dei, [A]Filius [D]Patris.
[D]Qui tollis peccata mundi, [A]miserere [D]nobis.
Qui tollis peccata mundi, [G]suscipe depreca[A]tionem [D]nostram.
[D]Qui sedes ad dexteram Patris, [A]miserere [D]nobis.
[D]Quoniam tu solus sanctus. [A]Tu solus Dominus.
Tu [G]solus Altissimus, [D]Jesu [A]Chris[D]te.
Cum [G]Sancto Spiritu, in [D]gloria Dei [A]Pa[D]tris. [G]A[D]men.`),

  S('alleluia-chant', 'Alleluia (Gospel acclamation)', 'G', 'Acclamation', `
{Alleluia}
[G]Alle[C]lu[G]ia, [D]alle[G]luia,
[G]alle[Em]lu[C]ia, [D]alle[G]luia.`),

  S('sanctus-chant', 'Sanctus (chant)', 'D', 'Holy', `
{Sanctus}
[D]Sanctus, [G]Sanctus, [D]Sanctus
[A]Dominus Deus [D]Sabaoth.
[D]Pleni sunt caeli et [G]terra [D]gloria [A]tua.
[D]Hosanna in ex[A]cel[D]sis.
{Benedictus}
[D]Benedictus qui [G]venit in [D]nomine [A]Domini.
[D]Hosanna in ex[A]cel[D]sis.`),

  S('agnus-dei-chant', 'Agnus Dei (chant)', 'D', 'Peace', `
{Agnus Dei}
[D]Agnus Dei, qui [G]tollis pec[D]cata [A]mundi:
[D]mise[G]rere [A]no[D]bis.
[D]Agnus Dei, qui [G]tollis pec[D]cata [A]mundi:
[D]mise[G]rere [A]no[D]bis.
[D]Agnus Dei, qui [G]tollis pec[D]cata [A]mundi:
[D]dona [G]nobis [A]pa[D]cem.`),

  // ---- More Communion and Eucharistic hymns ----
  S('o-lord-i-am-not-worthy', 'O Lord, I Am Not Worthy', 'F', 'Communion', `
{Verse 1}
O [F]Lord, I am not [C]worthy
That [F]Thou shouldst come to [C]me;
But [F]speak the words of [Bb]comfort,
My [F]spirit [C]healed shall [F]be.
{Verse 2}
And [F]humbly I'll re[C]ceive Thee,
The [F]Bridegroom of my [C]soul,
No [F]more by sin to [Bb]grieve Thee,
Or [F]fly Thy [C]sweet con[F]trol.`),

  S('jesus-my-lord-my-god', 'Jesus, My Lord, My God, My All', 'G', 'Communion', `
{Verse 1}
[G]Jesus, my Lord, my [D]God, my [G]all,
How [C]can I love Thee [G]as I [D]ought?
And [G]how revere this [D]wondrous [G]gift,
So [C]far sur[G]passing [D]hope or [G]thought?
{Chorus}
Sweet [C]Sacrament, we [G]Thee a[D]dore;
O [G]make us love Thee [C]more and [D]more.
O [G]make us [C]love Thee [D]more and [G]more.`),

  S('o-bread-of-heaven', 'O Bread of Heaven', 'D', 'Communion', `
{Verse 1}
O [D]Bread of Heaven, be[A]neath this [D]veil
Thou [G]dost my very [D]God con[A]ceal;
My [D]Jesus, dearest [A]treasure, [D]hail!
I [G]love Thee and, a[D]doring, [A]kneel;
Each [D]loving soul by [G]Thee is [D]fed
With [G]Thine own self in [A]form of [D]bread.`),

  S('sweet-heart-of-jesus', 'Sweet Heart of Jesus', 'F', 'Communion', `
{Verse 1}
Sweet [F]Heart of Jesus, [Bb]fount of love and [F]mercy,
To[F]day we come Thy [C]blessing to im[F]plore;
O [F]touch our hearts, so [Bb]cold and so un[F]grateful,
And [F]make them, Lord, Thine [C]own for ever[F]more.
{Chorus}
Sweet [Bb]Heart of [F]Jesus, we im[C]plore,
O [F]make us [Bb]love Thee [C]more and [F]more.`),

  // ---- Holy Spirit, St Joseph and Lent ----
  S('come-holy-ghost', 'Come, Holy Ghost, Creator Blest', 'D', 'Entrance', `
{Verse 1}
[D]Come, Holy [G]Ghost, Cre[D]ator [A]blest,
And [D]in our [G]hearts take [A]up Thy [D]rest;
Come [D]with Thy [G]grace and [D]heavenly [A]aid
To [D]fill the [G]hearts which [A]Thou hast [D]made.`),

  S('veni-creator', 'Veni Creator Spiritus', 'D', 'Entrance', `
{Verse 1}
[D]Veni, Cre[G]ator [D]Spiri[A]tus,
[D]mentes tu[G]orum [A]visi[D]ta,
[D]imple su[G]perna [D]grati[A]a,
[D]quae tu cre[G]asti [A]pecto[D]ra.`),

  S('hail-holy-joseph', 'Hail, Holy Joseph, Hail', 'G', 'Recessional', `
{Verse 1}
[G]Hail, holy Joseph, [D]hail!
[G]Chaste spouse of Mary, [D]hail!
[G]Pure as the [C]lily [G]flower
In [C]Eden's [G]peaceful [D]vale.
[G]Hail, holy Joseph, [D]hail!
[G]Father of Christ es[D]teemed!
[G]Father be [C]thou to [G]those
Thy [C]foster [D]Son re[G]deemed.`),

  S('attende-domine', 'Attende Domine', 'Dm', 'Lent', `
{Refrain}
At[Dm]tende, Domine, et [Gm]mise[Dm]rere,
qui[F]a pecca[C]vimus [Dm]tibi.`),

  S('parce-domine', 'Parce Domine', 'Dm', 'Lent', `
{Refrain}
[Dm]Parce, Domine, [Gm]parce [Dm]populo tuo:
ne in ae[F]ternum i[C]rascaris [Dm]nobis.`),

  S('ye-sons-and-daughters', 'Ye Sons and Daughters (O Filii et Filiae)', 'D', 'Easter', `
{Refrain}
[D]Alle[A]luia, [D]alle[A]luia, [D]alle[G]lu[A]i[D]a!
{Verse 1}
Ye [D]sons and daughters, [A]let us [D]sing!
The [D]King of heaven, the [G]glorious [A]King,
O'er [D]death to[G]day rose [A]triumph[D]ing.
[D]Alle[G]lu[A]i[D]a!`),

  // ---- More for Our Lady ----
  S('daily-daily-sing-to-mary', 'Daily, Daily Sing to Mary', 'F', 'Marian', `
{Verse 1}
[F]Daily, daily [C]sing to [F]Mary,
Sing, my soul, her [C]praises [F]due;
All her feasts, her [C]actions [F]worship,
With the heart's de[C]votion [F]true.
[Bb]Lost in wond'ring [F]contem[C]plation
[F]Be her majes[G]ty con[C]fessed:
[F]Call her Mother, [C]call her [F]Virgin,
[Bb]Happy [F]Mother, [C]Virgin [F]blest.`),

  S('o-purest-of-creatures', 'O Purest of Creatures', 'D', 'Marian', `
{Verse 1}
O [D]purest of creatures! Sweet [A]Mother, sweet [D]Maid;
The one spotless womb wherein [E]Jesus was [A]laid.
Dark [D]night hath come down on us, [G]Mother, and [D]we
Look [G]out for thy [D]shining, sweet [A]Star of the [D]Sea.`),

  S('ave-maris-stella', 'Ave Maris Stella', 'Dm', 'Marian', `
{Verse 1}
[Dm]Ave, maris [C]stella,
[F]Dei mater [C]alma,
[Dm]atque semper [Gm]virgo,
[F]felix cae[C]li [Dm]porta.`),

  // ---- Children's songs ----
  S('whole-world-in-his-hands', "He's Got the Whole World in His Hands", 'F', 'Spirituals', `
{Chorus}
He's got the [F]whole world in His hands,
He's got the [C]whole wide world in His hands,
He's got the [F]whole world in His hands,
He's [C]got the whole world in His [F]hands.
{Verse 2}
He's got the [F]little tiny baby in His hands,
He's got the [C]little tiny baby in His hands,
He's got the [F]little tiny baby in His hands,
He's [C]got the whole world in His [F]hands.
{Verse 3}
He's got [F]everybody here in His hands,
He's got [C]everybody here in His hands,
He's got [F]everybody here in His hands,
He's [C]got the whole world in His [F]hands.`, 'song'),

];
