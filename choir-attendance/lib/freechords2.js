// More public-domain hymns and carols (words and tunes old enough to be free for anyone to use).
// Chords are simple and common: check them against your own hymn book. Songs still under copyright are not here.
const S = (id, title, key, category, body, kind = 'hymn') => ({ id, title, key, kind, category, body: body.trim() });

export const MORE_CHORDS = [
  S('o-holy-night', 'O Holy Night', 'C', 'Christmas', `
{Verse 1}
O [C]holy night, the [F]stars are brightly [C]shining,
It is the [Am]night of the dear [E]Saviour's [Am]birth.
[F]Long lay the [C]world in [G]sin and error [C]pining,
Till [F]He appeared and the [C]soul felt its [G]worth.
A [C]thrill of hope, the [G]weary world re[C]joices,
For [F]yonder breaks a [C]new and glorious [G]morn.
{Chorus}
Fall on your [C]knees! O [F]hear the angel [C]voices!
O night [F]divine, O night when [C]Christ was [G]born;
O night di[C]vine, O [G]night, O night di[C]vine.`),

  S('holly-and-the-ivy', 'The Holly and the Ivy', 'D', 'Christmas', `
{Verse 1}
The [D]holly and the [G]ivy, when [D]they are both full [A]grown,
Of [D]all the trees that [G]are in the [D]wood, the [A]holly bears the [D]crown.
{Chorus}
O the [D]rising of the [G]sun, and the [D]running of the [A]deer,
The [D]playing of the [G]merry organ, [D]sweet singing in the [A]choir.
{Verse 2}
The [D]holly bears a [G]blossom, as [D]white as lily [A]flower,
And [D]Mary bore sweet [G]Jesus Christ to [D]be our sweet [A]Saviour.`),

  S('ding-dong-merrily', 'Ding Dong Merrily on High', 'G', 'Christmas', `
{Verse 1}
[G]Ding dong! merrily on [D]high, in [G]heaven the bells are [D]ringing:
[G]Ding dong! verily the [D]sky is [G]riven with angel [D]singing.
{Chorus}
Glo-[G]o-o-o-o-[C]o-o-o-o-[G]o-o-o-o-[D]ria,
[G]Hosanna in ex[D]celsis[G]!`),

  S('i-saw-three-ships', 'I Saw Three Ships', 'C', 'Christmas', `
{Verse 1}
I [C]saw three ships come [F]sailing [C]in,
On [G]Christmas [C]Day, on [G]Christmas [C]Day;
I [C]saw three ships come [F]sailing [C]in,
On [G]Christmas [C]Day in the [G]mor[C]ning.
{Verse 2}
And [C]what was in those [F]ships all [C]three,
On [G]Christmas [C]Day, on [G]Christmas [C]Day?
And [C]what was in those [F]ships all [C]three,
On [G]Christmas [C]Day in the [G]mor[C]ning?
{Verse 3}
Our [C]Saviour Christ and [F]His la[C]dy,
On [G]Christmas [C]Day, on [G]Christmas [C]Day;
Our [C]Saviour Christ and [F]His la[C]dy,
On [G]Christmas [C]Day in the [G]mor[C]ning.`),

  S('coventry-carol', 'Coventry Carol', 'Am', 'Christmas', `
{Verse 1}
[Am]Lully, lulla, [G]thou little tiny [Am]child,
[Dm]By by, [Am]lully [E]lullay.
[Am]Lully, lulla, [G]thou little tiny [Am]child,
[Dm]By by, [E]lully [Am]lullay.`),

  S('o-christmas-tree', 'O Christmas Tree', 'C', 'Christmas', `
{Verse 1}
O [C]Christmas tree, O [G]Christmas tree,
How [C]lovely are thy [G]branches;
O [C]Christmas tree, O [F]Christmas tree,
How [C]lovely are thy [G]bran[C]ches.
Not [C]only green in [G]summer's heat,
But [C]also winter's [G]snow and sleet.
O [C]Christmas tree, O [F]Christmas tree,
How [C]lovely are thy [G]bran[C]ches.`),

  S('what-child-is-this', 'What Child Is This', 'Em', 'Christmas', `
{Verse 1}
[Em]What child is [G]this, who [D]laid to [Bm]rest,
On [Em]Mary's [G]lap is [B7]sleeping?
[Em]Whom angels [G]greet with [D]anthems [Bm]sweet,
While [Em]shepherds [D]watch are [B7]keeping?
{Chorus}
This, [G]this is Christ the [D]King,
Whom [Em]shepherds guard and [B7]angels sing:
[G]Haste, haste to bring Him [D]laud,
The [Em]babe, the son of [B7]Mary[Em].`),

  S('once-in-royal', 'Once in Royal David\'s City', 'F', 'Christmas', `
{Verse 1}
[F]Once in royal [Bb]David's [F]city
Stood a [C]lowly cattle [F]shed,
Where a [F]mother [Bb]laid her [F]baby
In a [C]manger for His [F]bed:
[Bb]Mary was that [F]mother mild,
[C]Jesus Christ her [F]little child.`),

  S('see-amid-winters-snow', 'See, Amid the Winter\'s Snow', 'G', 'Christmas', `
{Verse 1}
[G]See, amid the [D]winter's snow,
[G]Born for us on [C]earth be[D]low;
[G]See, the tender [Em]Lamb appears,
[C]Promised from e[G]ternal [D]years.
{Chorus}
[G]Hail, thou ever-[C]blessed morn;
[G]Hail, redemp[D]tion's happy [G]dawn;
[C]Sing through all Jeru[G]salem:
[D]Christ is born in Beth[G]lehem.`),

  S('up-on-the-housetop', 'Up on the Housetop', 'G', 'Christmas', `
{Verse 1}
[G]Up on the housetop reindeer [D]pause,
Out jumps good old Santa [G]Claus;
[G]Down through the chimney with lots of [D]toys,
All for the little ones' [G]Christmas joys.
{Chorus}
[C]Ho, ho, ho! Who wouldn't [G]go?
[C]Ho, ho, ho! Who wouldn't [G]go?
[G]Up on the housetop, [D]click, click, click,
[G]Down through the chimney with good Saint [D]Nick[G].`, 'song'),

  S('o-come-little-children', 'O Come, Little Children', 'C', 'Christmas', `
{Verse 1}
O [C]come, little [G]children, O [C]come one and [G]all,
To [C]Bethlehem [F]haste to the [C]manger so [G]small;
O [C]see in the [F]stable the [C]light shining [G]clear,
Come [C]hasten, the [G]Christ child is [C]here.`, 'song'),

  S('rise-up-shepherd', 'Rise Up, Shepherd, and Follow', 'G', 'Christmas', `
{Verse 1}
There's a [G]star in the east on [C]Christmas morn,
[G]Rise up, shepherd, and [D]follow.
It will [G]lead to the place where [C]Christ was born,
[G]Rise up, shepherd, and [D]fol[G]low.
{Chorus}
[G]Follow, follow, [C]rise up, shepherd, and [G]follow;
[G]Follow the star of [D]Bethlehem,
[G]Rise up, shepherd, and [D]fol[G]low.`, 'song'),

  S('mighty-fortress', 'A Mighty Fortress Is Our God', 'C', 'Entrance', `
{Verse 1}
A [C]mighty for[G]tress is our [Am]God, a [F]bulwark [C]never [G]fail[C]ing;
Our [C]helper [G]He, amid the [Am]flood of [F]mortal [C]ills pre[G]vail[C]ing:
For [Am]still our [Em]ancient [Am]foe doth [Em]seek to [Am]work us [F]woe;
His [C]craft and [G]power are [Am]great, and [F]armed with [C]cruel [G]hate,
On [C]earth is [G]not his [Am]equal.`),

  S('all-hail-power', 'All Hail the Power of Jesus\' Name', 'G', 'Entrance', `
{Verse 1}
All [G]hail the [C]power of [G]Jesus' [D]name!
Let [G]angels [C]prostrate [G]fall;
Bring [Em]forth the [C]royal [G]diadem,
And [C]crown Him [G]Lord of [D]all[G].
Bring [Em]forth the [C]royal [G]diadem,
And [C]crown Him [G]Lord of [D]all[G].`),

  S('come-thou-almighty-king', 'Come, Thou Almighty King', 'G', 'Entrance', `
{Verse 1}
[G]Come, Thou Al[D]mighty [G]King,
Help us Thy [C]name to [G]sing,
Help us to [D]praise:
[G]Father, all [D]glorious,
O'er all vic[C]torious,
[G]Come and reign [D]over [G]us,
[C]Ancient of [D]Days[G].`),

  S('joyful-joyful', 'Joyful, Joyful, We Adore Thee', 'D', 'Entrance', `
{Verse 1}
[D]Joyful, joyful, we adore Thee, [A]God of glory, [D]Lord of love;
[D]Hearts unfold like flowers be[G]fore Thee, [D]opening to the [A]sun a[D]bove.
[D]Melt the clouds of sin and sadness; [A]drive the dark of doubt a[D]way;
[Bm]Giver of immortal [G]gladness, [D]fill us with the [A]light of [D]day.`),

  S('o-for-a-thousand-tongues', 'O for a Thousand Tongues to Sing', 'G', 'Entrance', `
{Verse 1}
O [G]for a thousand [D]tongues to [G]sing
My [C]great Redeemer's [G]praise,
The [G]glories of my [D]God and [G]King,
The [C]triumphs of His [D]grace[G].`),

  S('love-divine', 'Love Divine, All Loves Excelling', 'G', 'Communion', `
{Verse 1}
[G]Love divine, all [C]loves ex[G]celling,
Joy of [D]heaven, to earth come [G]down,
[G]Fix in us Thy [C]humble [G]dwelling,
All Thy [D]faithful mercies [G]crown.
[Em]Jesus, Thou art [Am]all com[Em]passion,
[C]Pure, unbounded [G]love Thou [D]art;
[G]Visit us with [C]Thy sal[G]vation,
En[D]ter every [G]trembling heart.`),

  S('lords-my-shepherd', 'The Lord\'s My Shepherd', 'F', 'Communion', `
{Verse 1}
The [F]Lord's my shep[Bb]herd, I'll [F]not want.
He [C]makes me down to [F]lie
In [F]pastures green; He [Bb]leadeth [F]me
The [C]quiet waters [F]by.
{Verse 2}
My [F]soul He doth re[Bb]store a[F]gain,
And [C]me to walk doth [F]make
With[F]in the paths of [Bb]righteous[F]ness,
E'en [C]for His own name's [F]sake.`),

  S('nearer-my-god', 'Nearer, My God, to Thee', 'F', 'Communion', `
{Verse 1}
[F]Nearer, my God, to [Bb]Thee, [F]nearer to [C]Thee!
[F]E'en though it [Bb]be a [F]cross that [C]raiseth [F]me,
[F]Still all my [Bb]song shall [F]be,
[C]Nearer, my God, to [F]Thee,
[F]Nearer, my [C]God, to [F]Thee, nearer to [C]Thee![F]`),

  S('jesus-lover-of-my-soul', 'Jesus, Lover of My Soul', 'D', 'Communion', `
{Verse 1}
[D]Jesus, lover of my [G]soul, [D]let me to Thy [A]bosom fly,
[D]While the nearer waters [G]roll, [D]while the tempest [A]still is [D]high;
[D]Hide me, O my Saviour, [G]hide, [D]till the storm of [A]life is [D]past;
[Bm]Safe into the [G]haven [D]guide, [A]O receive my [D]soul at last.`),

  S('take-my-life', 'Take My Life and Let It Be', 'G', 'Communion', `
{Verse 1}
[G]Take my life and let it [D]be
Con[G]secrated, [C]Lord, to [D]Thee;
[G]Take my hands and [C]let them [G]move
At the [D]impulse of Thy [G]love,
At the [D]impulse of Thy [G]love.
{Verse 2}
[G]Take my feet and let them [D]be
Swift and [G]beautiful for [C]Thee;
[G]Take my voice and [C]let me [G]sing
Always, [D]only, for my [G]King,
Always, [D]only, for my [G]King.`),

  S('trust-and-obey', 'Trust and Obey', 'D', 'Communion', `
{Verse 1}
When we [D]walk with the Lord in the [G]light of His [D]Word,
What a [D]glory He sheds on our [A]way!
While we [D]do His good will, He a[G]bides with us [D]still,
And with [D]all who will [A]trust and o[D]bey.
{Chorus}
Trust and o[D]bey, for there's [G]no other [D]way
To be [D]happy in [A]Jesus, but to [D]trust and o[A]bey[D].`),

  S('standing-on-promises', 'Standing on the Promises', 'C', 'Communion', `
{Verse 1}
[C]Standing on the promises of [F]Christ my King,
[C]Through eternal ages let His [G]praises ring;
[C]Glory in the highest, I will [F]shout and sing,
[C]Standing on the [G]promi[C]ses of God.
{Chorus}
[C]Standing, standing, [G]standing on the promises of [C]God my Saviour;
[C]Standing, standing, [F]I'm standing on the [G]promises of [C]God.`),

  S('tell-me-the-old-story', 'Tell Me the Old, Old Story', 'G', 'Communion', `
{Verse 1}
[G]Tell me the old, old [C]story of [G]unseen things a[D]bove,
[G]Of Jesus and His [C]glory, of [G]Jesus and His [D]love.
Tell [G]me the story [C]simply, as [G]to a little [D]child,
For [G]I am weak and [C]weary, and [G]helpless and de[D]filed.
{Chorus}
Tell me the [G]old, old story, [C]tell me the old, old [G]story,
Tell me the [G]old, old story, of [D]Jesus and His [G]love.`),

  S('i-love-to-tell-the-story', 'I Love to Tell the Story', 'G', 'Communion', `
{Verse 1}
I [G]love to tell the [C]story of [G]unseen things a[D]bove,
Of [G]Jesus and His [C]glory, of [G]Jesus and His [D]love;
I [G]love to tell the [C]story, be[G]cause I know 'tis [D]true;
It [G]satisfies my [C]longings as [G]nothing else [D]can [G]do.
{Chorus}
I love to [G]tell the story, [D]'twill be my theme in [G]glory,
To [G]tell the old, old story of [D]Jesus and His [G]love.`),

  S('blest-be-the-tie', 'Blest Be the Tie That Binds', 'F', 'Communion', `
{Verse 1}
[F]Blest be the [Bb]tie that [F]binds
Our [C]hearts in Chris[F]tian love;
The [F]fellowship of [Bb]kindred [F]minds
Is [C]like to that a[F]bove.`),

  S('great-is-thy-faithfulness', 'Great Is Thy Faithfulness', 'D', 'Communion', `
{Verse 1}
[D]Great is Thy [G]faithfulness, [D]O God my [A]Father,
[D]There is no [G]shadow of [D]turning with [A]Thee;
[D]Thou changest [G]not, Thy com[D]passions, they [A]fail not;
[Bm]As Thou hast [G]been Thou for[D]ever wilt [A]be[D].
{Chorus}
Great is Thy [G]faithfulness! [D]Great is Thy [A]faithfulness!
[D]Morning by [G]morning new [D]mercies I [A]see;
[D]All I have [G]needed Thy [D]hand hath pro[A]vided;
Great is Thy [G]faithfulness, [D]Lord, unto [A]me[D]!`),

  S('he-leadeth-me', 'He Leadeth Me', 'F', 'Communion', `
{Verse 1}
[F]He leadeth me, O blessed thought! O [C]words with heavenly [F]comfort fraught!
[F]Whate'er I do, where'er I [Bb]be, [F]still 'tis God's [C]hand that [F]leadeth me.
{Chorus}
He leadeth [F]me, He leadeth [Bb]me,
By His own [F]hand He leadeth [C]me;
His faithful [F]follower I would [Bb]be,
For [F]by His [C]hand He [F]leadeth me.`),

  S('beneath-the-cross', 'Beneath the Cross of Jesus', 'G', 'Communion', `
{Verse 1}
Be[G]neath the cross of [C]Jesus I [G]fain would take my [D]stand,
The [G]shadow of a [C]mighty rock with[G]in a weary [D]land;
A [G]home within the [C]wilderness, a [G]rest upon the [D]way,
From the [G]burning of the [C]noon-tide heat, and the [D]burden of the [G]day.`),

  S('up-from-the-grave', 'Up from the Grave He Arose', 'G', 'Easter', `
{Verse 1}
[G]Low in the grave He lay, [D]Jesus, my Saviour,
[G]Waiting the coming day, [D]Jesus, my [G]Lord.
{Chorus}
[G]Up from the grave He a[C]rose,
With a [G]mighty triumph o'er His [D]foes;
He a[G]rose a Victor from the [C]dark do[G]main,
And He [G]lives forever with His [D]saints to [G]reign;
He a[C]rose! He a[G]rose! [D]Hallelu[G]jah! Christ arose!`),

  S('o-sacred-head', 'O Sacred Head, Now Wounded', 'Am', 'Lent', `
{Verse 1}
O [Am]sacred head, now [E]wounded, with [Am]grief and shame weighed [Dm]down,
Now [Am]scornfully sur[E]rounded with [Am]thorns, Thine only [E]crown;
O [Am]sacred head, what [Dm]glory, what [E]bliss till now was [Am]Thine!
Yet, [Dm]though despised and [Am]gory, I [E]joy to call Thee [Am]mine.`),

  S('forty-days', 'Lord, Who Throughout These Forty Days', 'G', 'Lent', `
{Verse 1}
[G]Lord, who throughout these [D]forty days
For [G]us did fast and [C]pray,
[G]Teach us to [D]overcome our [Em]sin
And [C]close by [D]Thee [G]stay.`),

  S('rejoice-the-lord-is-king', 'Rejoice, the Lord Is King', 'D', 'Entrance', `
{Verse 1}
[D]Rejoice, the Lord is King! Your [A]Lord and King a[D]dore;
[D]Rejoice, give thanks and sing, and [A]triumph evermore.
[D]Lift up your heart, lift up your [G]voice;
Re[D]joice, again I [A]say, re[D]joice!`),

  S('jesus-bids-us-shine', 'Jesus Bids Us Shine', 'G', 'Children', `
{Verse 1}
[G]Jesus bids us shine with a [D]clear, pure light,
[G]Like a little candle burning [D]in the night;
[G]In this world of darkness, [C]so we must shine,
[G]You in your small corner, [D]and I in [G]mine.`, 'song'),

  S('immaculate-mary', 'Immaculate Mary (Lourdes Hymn)', 'G', 'Marian', `
{Verse 1}
Im[G]maculate Mary, [D]your praises we [G]sing,
You [G]reign now in heaven [D]with Jesus our [G]King.
{Chorus}
[G]Ave, [C]Ave, [G]Ave Ma[D]ri[G]a,
[G]Ave, [C]Ave, [G]Ave Ma[D]ri[G]a.`),

  S('bring-flowers', 'Bring Flowers of the Rarest', 'G', 'Marian', `
{Verse 1}
Bring [G]flowers of the [D]rarest, bring [G]blossoms the fairest,
From [G]garden and [D]woodland and [G]hillside and [D]vale;
Our [G]full hearts are [C]swelling, our [G]glad voices [D]telling
The [G]praise of the [C]loveliest [D]rose of the [G]vale.
{Chorus}
O [G]Mary, we crown thee with [D]blossoms to[G]day,
Queen of the [D]Angels, Queen of the [G]May.
O [G]Mary, we crown thee with [D]blossoms to[G]day,
Queen of the [D]Angels, Queen of the [G]May.`),

  S('hail-queen-of-heaven', 'Hail, Queen of Heaven', 'F', 'Marian', `
{Verse 1}
[F]Hail, Queen of [Bb]Heaven, the [F]ocean [C]star,
[F]Guide of the [Bb]wanderer [F]here [C]below;
[F]Thrown on life's [Bb]surge, we [F]claim thy [C]care,
[F]Save us from [Bb]peril and [C]from [F]woe.
{Chorus}
[F]Mother of [Bb]Christ, [F]star of the [C]sea,
[F]Pray for the [Bb]wanderer, [C]pray for [F]me.`),

  S('hail-holy-queen', 'Hail, Holy Queen', 'C', 'Marian', `
{Verse 1}
[C]Hail, holy Queen enthroned a[G]bove, O [C]Maria,
[C]Hail, Queen of mercy and of [G]love, O [C]Maria.
{Chorus}
[F]Triumph all ye cherubim,
[C]Sing with us ye seraphim,
[F]Heaven and earth resound the [C]hymn:
[G]Salve, salve, salve [C]Regina.`),

  S('tantum-ergo', 'Tantum Ergo', 'G', 'Communion', `
{Verse 1}
[G]Tantum ergo [D]sacramentum
[G]Veneremur [C]cernui,
Et [G]antiquum [D]documentum
[G]Novo cedat [D]ritui;
[G]Praestet fides [C]supplementum
[G]Sensuum de[D]fectui[G].`),

  S('o-salutaris', 'O Salutaris Hostia', 'C', 'Communion', `
{Verse 1}
[C]O salutaris [G]Hostia,
[C]Quae caeli [F]pandis [C]ostium;
[C]Bella premunt [G]hostilia,
[C]Da robur, [F]fer au[G]xi[C]lium.`),

  S('let-us-break-bread', 'Let Us Break Bread Together', 'G', 'Spirituals', `
{Verse 1}
Let us [G]break bread to[C]gether on our [G]knees,
Let us [G]break bread to[D]gether on our [G]knees;
When I [G]fall on my [C]knees, with my [G]face to the rising [D]sun,
O [G]Lord, have mer[D]cy on [G]me.`),

  S('go-down-moses', 'Go Down, Moses', 'Am', 'Spirituals', `
{Verse 1}
When [Am]Israel was in [E]Egypt's land: [Am]Let my people go,
[Am]Oppressed so hard they [E]could not stand, [Am]Let my people go.
{Chorus}
Go [Am]down, Moses, [Dm]way down in Egypt's [Am]land,
Tell old [Am]Pharaoh, [E]Let my people [Am]go.`),
];
