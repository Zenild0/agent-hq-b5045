// A starter library of chord sheets for hymns, carols and children's songs whose words and tunes are in the
// public domain, so anyone may use and share them. The teacher can save any of them to the Chord Book with one tap
// and edit them afterwards. The chords are simple, common ones: check them against your own hymn book.
const S = (id, title, key, category, body, kind = 'hymn') => ({ id, title, key, kind, category, body: body.trim() });

export const FREE_CHORDS = [
  S('amazing-grace', 'Amazing Grace', 'G', 'Recessional', `
{Verse 1}
[G]Amazing grace, how [G7]sweet the [C]sound,
That [G]saved a wretch like [Em]me; [D]
I [G]once was lost, but [G7]now am [C]found,
Was [G]blind, but [D]now I [G]see.
{Verse 2}
'Twas [G]grace that taught my [G7]heart to [C]fear,
And [G]grace my fears re[Em]lieved; [D]
How [G]precious did that [G7]grace ap[C]pear
The [G]hour I [D]first be[G]lieved.
{Verse 3}
Through [G]many dangers, [G7]toils and [C]snares,
I [G]have already [Em]come; [D]
'Tis [G]grace hath brought me [G7]safe thus [C]far,
And [G]grace will [D]lead me [G]home.`),

  S('silent-night', 'Silent Night', 'C', 'Christmas', `
{Verse 1}
[C]Silent night, holy night,
All is calm, all is [G7]bright;
[C]Round yon virgin, [F]mother and [C]child,
Holy [F]infant so tender and [C]mild,
Sleep in [G]heavenly [C]peace,
Sleep in [G]heavenly [C]peace.
{Verse 2}
[C]Silent night, holy night,
Shepherds quake at the [G7]sight;
[C]Glories stream from [F]heaven a[C]far,
Heavenly [F]hosts sing Alle[C]luia;
Christ the [G]Saviour is [C]born,
Christ the [G]Saviour is [C]born.
{Verse 3}
[C]Silent night, holy night,
Son of God, love's pure [G7]light;
[C]Radiant beams from Thy [F]holy [C]face,
With the [F]dawn of redeeming [C]grace,
Jesus, [G]Lord, at Thy [C]birth,
Jesus, [G]Lord, at Thy [C]birth.`),

  S('joy-to-the-world', 'Joy to the World', 'D', 'Christmas', `
{Verse 1}
[D]Joy to the world, the [A]Lord is [D]come;
Let [G]earth re[D]ceive her [A]King; [D]
Let every heart pre[G]pare Him [D]room,
And [A]heaven and nature [D]sing,
And [G]heaven and nature [A]sing,
And [D]heaven, and [A]heaven and nature [D]sing.
{Verse 2}
[D]Joy to the earth, the [A]Saviour [D]reigns;
Let [G]men their [D]songs em[A]ploy; [D]
While fields and floods, rocks, [G]hills and [D]plains
Re[A]peat the sounding [D]joy,
Re[G]peat the sounding [A]joy,
Re[D]peat, re[A]peat the sounding [D]joy.`),

  S('o-come-all-ye-faithful', 'O Come, All Ye Faithful', 'G', 'Christmas', `
{Verse 1}
[G]O come, all ye [D]faithful, [G]joyful and tri[D]umphant,
O [G]come ye, O [C]come ye to [D]Beth[G]lehem;
[G]Come and be[D]hold Him, [G]born the King of [D]angels;
{Refrain}
O [G]come, let us a[D]dore Him, O [G]come, let us a[D]dore Him,
O [G]come, let us a[D]dore Him, [G]Christ the [D]Lord, [G]
{Verse 2}
[G]God of God, [D]Light of [G]Light, [D]
Lo, He ab[G]hors not the [C]Virgin's [D]womb; [G]
[G]Very God, [D]begotten, not [G]created; [D]`),

  S('away-in-a-manger', 'Away in a Manger', 'G', 'Christmas', `
{Verse 1}
[G]Away in a manger, no [D]crib for a bed,
The [G]little Lord Jesus laid [D]down His sweet head;
The [G]stars in the bright sky looked [C]down where He [G]lay,
The [C]little Lord [G]Jesus, a[D]sleep on the [G]hay.
{Verse 2}
The [G]cattle are lowing, the [D]baby awakes,
But [G]little Lord Jesus, no [D]crying He makes;
I [G]love Thee, Lord Jesus, look [C]down from the [G]sky,
And [C]stay by my [G]cradle till [D]morning is [G]nigh.`),

  S('hark-the-herald', 'Hark! The Herald Angels Sing', 'G', 'Christmas', `
{Verse 1}
[G]Hark! The herald [D]angels [G]sing,
"Glory [C]to the [G]newborn [D]King;
[G]Peace on earth and [D]mercy [G]mild,
God and [C]sinners [G]recon[D]ciled!"
[G]Joyful, all ye [D]nations [G]rise,
Join the [C]triumph [G]of the [D]skies;
With th'[G]angelic [D]host pro[G]claim,
"Christ is [C]born in [G]Beth[D]le[G]hem!"
{Refrain}
[G]Hark! The herald [D]angels [G]sing,
"Glory [C]to the [G]newborn [D]King!" [G]`),

  S('the-first-noel', 'The First Noel', 'D', 'Christmas', `
{Verse 1}
The [D]first No[G]el the [D]angel did [A]say
Was to [D]certain poor [G]shepherds in [A]fields as they [D]lay;
In [D]fields where they [G]lay keeping [D]their [A]sheep,
On a [D]cold winter's [G]night that was [A]so [D]deep.
{Refrain}
No[D]el, No[G]el, No[D]el, No[A]el,
Born is the [D]King of Is[A]ra[D]el.`),

  S('o-little-town-of-bethlehem', 'O Little Town of Bethlehem', 'G', 'Christmas', `
{Verse 1}
O [G]little town of [D]Bethle[G]hem, how [C]still we [G]see thee [D]lie;
A[G]bove thy deep and [D]dream[G]less sleep the [C]silent [G]stars go [D]by;
Yet [G]in thy dark streets [D]shi[G]neth the [C]ever[G]lasting [D]Light;
The [G]hopes and fears of [D]all the [G]years are [C]met in [D]thee to[G]night.`),

  S('angels-we-have-heard', 'Angels We Have Heard on High', 'G', 'Christmas', `
{Verse 1}
[G]Angels we have heard on [D]high,
[G]Sweetly singing o'er the [D]plains,
[G]And the mountains in re[D]ply
[G]Echoing their joyous [D]strains.
{Refrain}
[G]Glo[C]ri[G]a in ex[D]cel[G]sis De[C]o,
[G]Glo[D]ri[G]a in ex[D]cel[G]sis De[D]o.`),

  S('go-tell-it-on-the-mountain', 'Go, Tell It on the Mountain', 'G', 'Christmas', `
{Refrain}
[G]Go, tell it on the [C]mountain,
[G]Over the hills and [D]everywhere;
[G]Go, tell it on the [C]mountain
That [G]Jesus Christ is [D]born. [G]
{Verse 1}
[G]While shepherds kept their [C]watching
[G]O'er silent flocks by [D]night,
[G]Behold throughout the [C]heavens
[G]There shone a holy [D]light. [G]`),

  S('o-come-o-come-emmanuel', 'O Come, O Come, Emmanuel', 'Em', 'Advent', `
{Verse 1}
O [Em]come, O come, Em[B7]manuel,
And [Em]ransom captive [D]Is[Em]rael,
That [G]mourns in lonely [D]exile [Em]here
Un[Am]til the [Em]Son of [B7]God ap[Em]pear.
{Refrain}
Re[G]joice! Re[D]joice! Em[Em]manuel
Shall [Am]come to [Em]thee, O [B7]Is[Em]rael.`),

  S('we-three-kings', 'We Three Kings', 'Em', 'Christmas', `
{Verse 1}
We [Em]three kings of Ori[B7]ent [Em]are,
Bearing [Em]gifts we traverse a[B7]far,
[Em]Field and fountain, [G]moor and mountain,
[D]Following [Em]yonder [B7]star. [Em]
{Refrain}
O star of [G]wonder, star of [D]night,
Star with [Em]royal [B7]beauty [Em]bright,
[Am]Westward [Em]leading, [B7]still pro[Em]ceeding,
[Am]Guide us [Em]to Thy [B7]perfect [Em]light.`),

  S('jingle-bells', 'Jingle Bells', 'G', 'Christmas', `
{Verse 1}
[G]Dashing through the snow in a [C]one-horse open [G]sleigh,
O'er the [G]fields we go, [C]laughing all the [D]way;
[G]Bells on bobtail ring, [C]making spirits [G]bright,
What [C]fun it is to [G]ride and sing a [D]sleighing song to[G]night!
{Chorus}
[G]Jingle bells, jingle bells, [C]jingle all the [G]way;
Oh, [C]what fun it is to [G]ride in a [D]one-horse open [G]sleigh, hey!`, 'song'),

  S('we-wish-you-a-merry-christmas', 'We Wish You a Merry Christmas', 'G', 'Christmas', `
{Verse 1}
[G]We wish you a merry [C]Christmas, we wish you a merry [G]Christmas,
We wish you a merry [C]Christmas and a [D]happy New [G]Year.
{Chorus}
[G]Good tidings we [D]bring to [G]you and your [C]kin;
[G]Good tidings for [C]Christmas and a [D]happy New [G]Year.`, 'song'),

  S('deck-the-halls', 'Deck the Halls', 'G', 'Christmas', `
{Verse 1}
[G]Deck the halls with [D]boughs of [G]holly,
Fa la la la la, [D]la la [G]la la;
'Tis the [G]season to be [D]jolly,
Fa la la la la, [D]la la [G]la la.
[G]Don we now our [D]gay ap[G]parel,
Fa la la, [D]la la la, la la [G]la;
[G]Troll the ancient [D]Yuletide [G]carol,
Fa la la la la, [D]la la [G]la la.`, 'song'),

  S('holy-holy-holy', 'Holy, Holy, Holy', 'D', 'Entrance', `
{Verse 1}
[D]Holy, holy, [A]holy! Lord God Al[D]mighty!
[D]Early in the [G]morning our [D]song shall rise to [A]Thee;
[D]Holy, holy, [A]holy! Merciful and [D]mighty!
[G]God in three [D]Persons, bless[A]ed [D]Trinity!
{Verse 2}
[D]Holy, holy, [A]holy! All the saints a[D]dore Thee,
[D]Casting down their [G]golden [D]crowns around the glassy [A]sea;
[D]Cherubim and [A]seraphim falling down be[D]fore Thee,
[G]Which wert, and [D]art, and [A]evermore [D]shalt be.`),

  S('what-a-friend-we-have-in-jesus', 'What a Friend We Have in Jesus', 'G', 'Communion', `
{Verse 1}
[G]What a friend we have in [C]Jesus, [G]all our sins and griefs to [D]bear!
[G]What a privilege to [C]carry [G]everything to God in [D]prayer!
[G]O what peace we often [C]forfeit, [G]O what needless pain we [D]bear,
[G]All because we do not [C]carry [G]everything to God in [D]prayer. [G]`),

  S('be-thou-my-vision', 'Be Thou My Vision', 'D', 'Communion', `
{Verse 1}
[D]Be Thou my vision, O [G]Lord of my [D]heart;
[D]Naught be all else to me, [A]save that Thou [D]art;
[D]Thou my best thought, by [G]day or by [D]night,
[D]Waking or sleeping, Thy [A]presence my [D]light.
{Verse 2}
[D]Be Thou my wisdom, and [G]Thou my true [D]word;
[D]I ever with Thee and [A]Thou with me, [D]Lord;
[D]Thou my great Father, [G]I Thy true [D]son,
[D]Thou in me dwelling, and [A]I with Thee [D]one.`),

  S('rock-of-ages', 'Rock of Ages', 'G', 'Communion', `
{Verse 1}
[G]Rock of Ages, [D]cleft for [G]me,
Let me [C]hide my[G]self in [D]Thee;
Let the [G]water and the [D]blood,
From Thy [C]wounded [G]side which [D]flowed,
Be of [G]sin the [D]double [G]cure,
[C]Save from [G]wrath and [D]make me [G]pure.`),

  S('come-thou-fount', 'Come, Thou Fount of Every Blessing', 'D', 'Communion', `
{Verse 1}
[D]Come, Thou Fount of [G]every [D]blessing,
[D]Tune my heart to [A]sing Thy [D]grace;
[D]Streams of mercy, [G]never [D]ceasing,
[D]Call for songs of [A]loudest [D]praise.
{Verse 2}
[D]Teach me some melo[G]dious [D]sonnet,
[D]Sung by flaming [A]tongues a[D]bove;
[D]Praise the mount, I'm [G]fixed up[D]on it,
[D]Mount of Thy re[A]deeming [D]love.`),

  S('it-is-well', 'It Is Well with My Soul', 'D', 'Communion', `
{Verse 1}
When [D]peace like a [G]river at[D]tendeth my [A]way,
When [D]sorrows like [G]sea billows [D]roll;
What[D]ever my [G]lot, Thou hast [D]taught me to [A]say,
[D]It is well, [A]it is [D]well with my [A]soul.
{Refrain}
It is [D]well, [G]with my [D]soul,
It is [D]well, [A]it is [D]well with my [A]soul.`),

  S('just-as-i-am', 'Just As I Am', 'D', 'Communion', `
{Verse 1}
[D]Just as I am, without [A]one [D]plea,
But that Thy [G]blood was [D]shed for [A]me,
And that Thou [D]bidd'st me [A]come to [D]Thee,
O [G]Lamb of [D]God, I [A]come, I [D]come.`),

  S('abide-with-me', 'Abide with Me', 'G', 'Communion', `
{Verse 1}
[G]Abide with me; fast [C]falls the even[G]tide;
The [D]darkness deepens; [G]Lord, with me a[D]bide.
When other [G]helpers fail and [C]comforts [G]flee,
Help of the [D]helpless, O a[G]bide with [D]me. [G]`),

  S('blessed-assurance', 'Blessed Assurance', 'D', 'Communion', `
{Verse 1}
[D]Blessed assur[A]ance, Jesus is [D]mine!
O what a fore[G]taste of glory di[D]vine!
Heir of sal[D]vation, purchase of [A]God,
Born of His [D]Spirit, washed in His [A]blood. [D]
{Refrain}
This is my [D]story, this is my [G]song,
Praising my [D]Saviour all the day [A]long;
This is my [D]story, this is my [G]song,
Praising my [D]Saviour [A]all the day [D]long.`),

  S('faith-of-our-fathers', 'Faith of Our Fathers', 'G', 'Recessional', `
{Verse 1}
[G]Faith of our [C]fathers, [G]living still,
In [D]spite of dungeon, [G]fire and sword;
O how our [G]hearts beat [C]high with [G]joy
Whene'[D]er we hear that [G]glorious Word!
{Refrain}
Faith of our [G]fathers, [C]holy [G]faith!
We will be [D]true to thee till [G]death.`),

  S('praise-to-the-lord', 'Praise to the Lord, the Almighty', 'G', 'Entrance', `
{Verse 1}
[G]Praise to the Lord, the Al[D]mighty, the [G]King of cre[D]ation!
O my [G]soul, praise Him, for [C]He is thy [G]health and sal[D]vation!
All ye who [G]hear, now to [C]His temple ap[D]pear,
Join in [G]glad ado[D]ration! [G]`),

  S('when-i-survey', 'When I Survey the Wondrous Cross', 'G', 'Communion', `
{Verse 1}
[G]When I sur[C]vey the [G]wondrous [D]cross
On [G]which the [C]Prince of [D]glory [G]died,
My [G]richest [C]gain I [G]count but [D]loss,
And [G]pour con[C]tempt on [D]all my [G]pride.`),

  S('all-creatures-of-our-god', 'All Creatures of Our God and King', 'D', 'Entrance', `
{Verse 1}
[D]All creatures of our God and [A]King,
[D]Lift up your voice and with us [A]sing,
[D]Alle[G]luia, [D]alle[A]luia!
[D]Thou burning sun with golden [A]beam,
[D]Thou silver moon with softer [A]gleam,
O [D]praise Him, O [G]praise Him,
[D]Alle[A]lu[D]ia, alle[A]lu[D]ia, alle[A]lu[D]ia!`),

  S('holy-god-we-praise', 'Holy God, We Praise Thy Name', 'G', 'Entrance', `
{Verse 1}
[G]Holy God, we [D]praise Thy [G]name;
Lord of [D]all, we bow be[G]fore Thee;
All on [G]earth Thy [C]sceptre [G]claim,
All in [D]heaven a[G]bove adore Thee;
In[G]finite Thy [C]vast do[G]main,
Ever[D]lasting is Thy [G]reign.`),

  S('jesus-loves-me', 'Jesus Loves Me', 'C', 'Children', `
{Verse 1}
[C]Jesus loves me, this I [G]know,
[C]For the Bible tells me [G]so;
[C]Little ones to Him be[F]long,
[C]They are weak but [G]He is [C]strong.
{Refrain}
[C]Yes, Jesus [F]loves me, [C]Yes, Jesus [G]loves me,
[C]Yes, Jesus [F]loves me, [C]The Bible [G]tells me [C]so.`, 'song'),

  S('this-little-light', 'This Little Light of Mine', 'G', 'Children', `
{Verse 1}
[G]This little light of mine, I'm gonna let it [C]shine;
[G]This little light of mine, I'm gonna let it [D]shine;
[G]This little light of mine, I'm gonna let it [C]shine,
Let it [G]shine, [D]let it shine, let it [G]shine.`, 'song'),
];
