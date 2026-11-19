// A third batch of public-domain hymns, carols and children's songs (added November 2026).
// Words and tunes are old enough to be free for anyone to use, in India and elsewhere. Chords are simple and
// common: check them against your own hymn book. This batch also goes straight into the Chord Book and, as words
// only, into the hymn list (once, see addNewSongs in server.js).
const S = (id, title, key, category, body, kind = 'hymn') => ({ id, title, key, kind, category, body: body.trim() });

export const NOV_2026_BATCH = 'nov2026';

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

  S('here-we-come-a-wassailing', 'Here We Come A-wassailing', 'G', 'Christmas', `
{Verse 1}
[G]Here we come a-[C]wassailing
A[G]mong the leaves so [D]green;
[G]Here we come a-[C]wand'ring
So [G]fair to [D]be [G]seen.
{Chorus}
[C]Love and joy come [G]to you,
And to [C]you your wassail [D]too;
And God [G]bless you and [C]send you a [G]happy New [Em]Year,
And [C]God send [G]you a [D]happy New [G]Year.`),

  S('jolly-old-saint-nicholas', 'Jolly Old Saint Nicholas', 'C', 'Christmas', `
{Verse 1}
[C]Jolly old Saint [G]Nicholas,
[C]Lean your ear this [G]way!
[C]Don't you tell a [F]single soul
[C]What I'm [G]going to [C]say;
[C]Christmas Eve is [G]coming soon;
[C]Now, you dear old [G]man,
[C]Whisper what you'll [F]bring to me;
[C]Tell me [G]if you [C]can.`, 'song'),

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

  S('churchs-one-foundation', "The Church's One Foundation", 'D', 'Entrance', `
{Verse 1}
The [D]Church's one foun[G]da[D]tion
Is [A]Jesus [D]Christ, her [A]Lord;
She [D]is His new cre[G]a[D]tion
By [Em]water [A]and the [D]word:
From [Bm]heaven He [F#m]came and [Bm]sought her
To [G]be His [D]holy [A]bride;
With [D]His own [G]blood He [D]bought her,
And [G]for her [A]life He [D]died.`),

  S('to-god-be-the-glory', 'To God Be the Glory', 'G', 'Entrance', `
{Verse 1}
To [G]God be the glory, great [C]things He hath [G]done;
So loved He the world that He [A]gave us His [D]Son,
Who [G]yielded His life an a[C]tonement for [G]sin,
And [C]opened the [G]life-gate that [D]all may go [G]in.
{Chorus}
Praise the [D]Lord, praise the [G]Lord, let the earth hear His [D]voice!
Praise the [G]Lord, praise the [C]Lord, let the [G]people re[D]joice!
O [G]come to the Father, through [C]Jesus the [G]Son,
And [C]give Him the [G]glory, great [D]things He hath [G]done.`),

  S('count-your-blessings', 'Count Your Blessings', 'G', 'Recessional', `
{Verse 1}
When up[G]on life's billows you are [C]tempest-[G]tossed,
When you are dis[A]couraged, thinking [D]all is lost,
[G]Count your many blessings, [C]name them one by [G]one,
And it [C]will sur[G]prise you what the [D]Lord hath [G]done.
{Chorus}
[G]Count your blessings, name them one by one;
[D]Count your blessings, see what [G]God hath done;
[G]Count your blessings, [C]name them one by [G]one;
[C]Count your [G]many blessings, see what [D]God hath [G]done.`),

  S('lead-kindly-light', 'Lead, Kindly Light', 'D', 'Recessional', `
{Verse 1}
[D]Lead, kindly [G]Light, a[D]mid the en[A]circling [D]gloom,
Lead [G]Thou me [A]on;
The [D]night is [G]dark, and [D]I am [A]far from [D]home;
Lead [G]Thou me [A]on.
[D]Keep Thou my [G]feet; I [D]do not [A]ask to [Bm]see
The [G]distant [D]scene; one [A]step e[D]nough for [A]me.`),

  S('shall-we-gather', 'Shall We Gather at the River', 'D', 'Recessional', `
{Verse 1}
[D]Shall we gather [G]at the [D]river,
Where bright angel [E]feet have [A]trod,
With its [D]crystal tide for[G]ever
[D]Flowing [A]by the throne of [D]God?
{Chorus}
[D]Yes, we'll gather at the river,
The [G]beautiful, the [D]beautiful [A]river;
[D]Gather with the [G]saints at the [D]river
That [D]flows by the [A]throne of [D]God.`),

  S('leaning-on-the-everlasting-arms', 'Leaning on the Everlasting Arms', 'G', 'Recessional', `
{Verse 1}
What a [G]fellowship, what a joy divine,
[C]Leaning on the [G]ever[D]lasting [G]arms;
What a blessedness, what a peace is mine,
[A]Leaning on the [D]everlasting arms.
{Chorus}
[G]Leaning, leaning,
[C]Safe and secure from [G]all a[D]larms;
[G]Leaning, leaning,
[C]Leaning on the [G]ever[D]lasting [G]arms.`),

  S('sweet-hour-of-prayer', 'Sweet Hour of Prayer', 'D', 'Recessional', `
{Verse 1}
[D]Sweet hour of prayer! [G]sweet hour of [D]prayer!
That calls me from a [A]world of [D]care,
And bids me at my [G]Father's [D]throne
Make all my wants and [A]wishes [D]known.
In [A]seasons of dis[D]tress and grief,
My [A]soul has often [D]found re[A]lief,
And [D]oft escaped the [G]tempter's [D]snare
By Thy re[G]turn, [D]sweet [A]hour of [D]prayer!`),

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

  // ---- Children's songs and spirituals ----
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

  S('jesus-wants-me-for-a-sunbeam', 'Jesus Wants Me for a Sunbeam', 'G', 'Children', `
{Verse 1}
[G]Jesus wants me for a sunbeam,
To [D]shine for Him each [G]day;
In every way try to please Him,
At [A]home, at school, at [D]play.
{Chorus}
A [G]sunbeam, a [C]sunbeam,
[G]Jesus wants me for a [D]sunbeam;
A [G]sunbeam, a [C]sunbeam,
I'll [G]be a [D]sunbeam for [G]Him.`, 'song'),

  S('o-how-i-love-jesus', 'O How I Love Jesus', 'G', 'Children', `
{Verse 1}
There [G]is a name I [C]love to [G]hear,
I love to sing its [D]worth;
It [G]sounds like music [C]in my [G]ear,
The [D]sweetest name on [G]earth.
{Chorus}
O how I [C]love [G]Jesus,
O how I love [D]Jesus,
O how I [C]love [G]Jesus,
Be[D]cause He first loved [G]me!`, 'song'),

  S('down-by-the-riverside', 'Down by the Riverside', 'G', 'Spirituals', `
{Verse 1}
Gonna [G]lay down my burden, down by the riverside,
[D]Down by the riverside, [G]down by the riverside;
Gonna [G]lay down my burden, down by the riverside,
And [D]study war no [G]more.
{Chorus}
I ain't gonna [C]study war no more,
[G]Ain't gonna study war no more,
[D]Ain't gonna study war no [G]more;
I ain't gonna [C]study war no more,
[G]Ain't gonna study war no more,
[D]Ain't gonna study war no [G]more.`, 'song'),

  S('do-lord', 'Do, Lord', 'G', 'Spirituals', `
{Chorus}
Do, Lord, oh [G]do, Lord, oh do remember me,
Do, Lord, oh [C]do, Lord, oh do remember [G]me,
Do, Lord, oh [G]do, Lord, oh do remember me,
[D]Way beyond the [G]blue.
{Verse 1}
I've got a [G]home in glory land that outshines the sun,
I've got a [C]home in glory land that outshines the [G]sun,
I've got a [G]home in glory land that outshines the sun,
[D]Way beyond the [G]blue.`, 'song'),
];
