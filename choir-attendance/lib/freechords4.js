// A fourth batch (December 2026): more public-domain Catholic hymns for the parish choir.
// Advent, Christmas, Holy Week, Eucharist, Our Lady, the Holy Spirit, and Latin chant. The words and tunes are old
// enough to be free for anyone to use. Chords are simple and common: check them against your own hymn book.
const S = (id, title, key, category, body, kind = 'hymn') => ({ id, title, key, kind, category, body: body.trim() });

export const MORE_CATHOLIC = [
  // ---- Advent ----
  S('creator-of-the-stars', 'Creator of the Stars of Night', 'D', 'Advent', `
{Verse 1}
Cre[D]ator of the [G]stars of [D]night,
Thy [G]people's ever[A]lasting [D]light,
[Bm]Jesu, Re[G]deemer, [D]save us [A]all,
And [D]hear Thy [G]servants [A]when they [D]call.`),

  S('hark-a-herald-voice', 'Hark! A Herald Voice Is Calling', 'F', 'Advent', `
{Verse 1}
[F]Hark! a herald [C]voice is [F]calling:
"[Bb]Christ is [F]nigh," it [C]seems to say;
"[F]Cast away the [C]dreams of [Dm]darkness,
[Bb]O ye [F]children [C]of the [F]day!"`),

  S('the-angel-gabriel', 'The Angel Gabriel from Heaven Came', 'Gm', 'Advent', `
{Verse 1}
The [Gm]angel Gabriel [D]from heaven [Gm]came,
His wings as drifted [D]snow, his eyes as [Gm]flame;
"All [Bb]hail," said he, "thou [F]lowly maiden [Bb]Mary,
Most [Gm]highly [Cm]favoured [D]lady," [Gm]Gloria!`),

  // ---- Christmas ----
  S('adeste-fideles', 'Adeste Fideles', 'G', 'Christmas', `
{Verse 1}
A[G]deste fi[D]deles, [G]laeti [D]trium[G]phantes,
Ve[Em]nite, [D]ve[A]nite in [D]Bethlehem:
[G]Natum vi[D]dete [G]Regem [C]ange[D]lorum:
{Refrain}
Ve[G]nite ado[D]remus, ve[G]nite ado[D]remus,
Ve[G]nite ado[C]re[G]mus [D]Domi[G]num.`),

  S('gentle-mary-laid-her-child', 'Gentle Mary Laid Her Child', 'D', 'Christmas', `
{Verse 1}
[D]Gentle Mary [G]laid her [D]child
[D]Lowly in a [A]manger;
[D]There He lay, the [G]unde[D]filed,
[D]To the world a [A]stran[D]ger:
[G]Such a babe in [D]such a place,
[Bm]Can He be the [E]Sav[A]iour?
[D]Ask the saved of [G]all the [D]race
[D]Who have found His [A]fa[D]vour.`),

  // ---- Lent and Holy Week ----
  S('ride-on-ride-on', 'Ride On, Ride On in Majesty', 'Dm', 'Lent', `
{Verse 1}
Ride [Dm]on! ride on in [A]majes[Dm]ty!
Hark! [F]all the tribes ho[C]sanna [F]cry;
O [Dm]Saviour meek, pur[Gm]sue Thy [A]road
With [Dm]palms and [Gm]scattered [A]garments [Dm]strowed.`),

  S('sing-my-tongue', 'Sing, My Tongue, the Glorious Battle', 'D', 'Lent', `
{Verse 1}
[D]Sing, my tongue, the [A]glorious [D]battle;
[G]Sing the last, the [A]dread af[D]fray;
[D]O'er the cross, the [A]victor's [Bm]trophy,
[G]Sound the high tri[A]umphal [D]lay:
[G]How, the pains of [D]death en[A]during,
[D]Earth's Re[G]deemer [A]won the [D]day.`),

  S('o-come-and-mourn', 'O Come and Mourn with Me Awhile', 'Dm', 'Lent', `
{Verse 1}
O [Dm]come and mourn with [A]me a[Dm]while;
See, [F]Mary calls us [C]to her [F]side;
O [Dm]come and let us [Gm]mourn with [A]her;
[Dm]Jesus, our [Gm]Love, is [A]cruci[Dm]fied.`),

  S('at-the-cross-her-station', 'At the Cross Her Station Keeping', 'Dm', 'Lent', `
{Verse 1}
[Dm]At the cross her [A]station [Dm]keeping,
[F]Stood the mournful [C]Mother [F]weeping,
[Gm]Close to [Dm]Jesus [A]to the [Dm]last.`),

  S('stabat-mater', 'Stabat Mater', 'Dm', 'Lent', `
{Verse 1}
[Dm]Stabat mater [A]doloro[Dm]sa
[F]juxta crucem [C]lacrimo[F]sa,
[Gm]dum pen[Dm]debat [A]Fili[Dm]us.`),

  S('ubi-caritas', 'Ubi Caritas', 'D', 'Offertory', `
{Refrain}
[D]Ubi [G]caritas et [D]amor,
[D]ubi [G]cari[D]tas, [A]Deus ibi [D]est.`),

  // ---- Easter and the Holy Spirit ----
  S('alleluia-sing-to-jesus', 'Alleluia! Sing to Jesus', 'F', 'Easter', `
{Verse 1}
[F]Alleluia! [C]sing to [F]Jesus!
[Bb]His the sceptre, [F]His the [C]throne;
[F]Alleluia! [C]His the [Dm]triumph,
[Bb]His the [F]victory [C]a[F]lone.`),

  S('come-down-o-love-divine', 'Come Down, O Love Divine', 'D', 'Entrance', `
{Verse 1}
Come [D]down, O Love di[G]vine,
Seek [D]Thou this soul of [A]mine,
And [D]visit it with Thine own [G]ardour [A]glowing;
O [D]Comforter, draw [G]near,
With[D]in my heart ap[A]pear,
And [G]kindle it, Thy [D]holy flame be[A]stow[D]ing.`),

  // ---- Entrance and praise ----
  S('hail-redeemer', 'Hail, Redeemer, King Divine', 'F', 'Entrance', `
{Verse 1}
[F]Hail, Redeemer, [C]King di[F]vine!
[Bb]Priest and Lamb, the [F]throne is [C]Thine,
[F]King, whose reign shall [C]never [Dm]cease,
[Bb]Prince of [F]ever[C]lasting [F]peace.
{Refrain}
[F]Angels, saints and [Bb]nations [F]sing:
"[F]Praised be Jesus [C]Christ, our [F]King;
[Bb]Lord of life, earth, [F]sky and [C]sea,
[F]King of [Bb]love on [C]Calva[F]ry."`),

  S('praise-to-the-holiest', 'Praise to the Holiest in the Height', 'F', 'Entrance', `
{Verse 1}
[F]Praise to the [Bb]Holiest [F]in the height,
And [C]in the depth be [F]praise,
In [Dm]all His [Gm]words most [C]wonder[F]ful,
Most [Bb]sure in [C]all His [F]ways.`),

  S('firmly-i-believe', 'Firmly I Believe and Truly', 'G', 'Entrance', `
{Verse 1}
[G]Firmly I be[D]lieve and [G]truly
[C]God is three, and [D]God is [G]one;
[G]And I next ac[D]knowledge [Em]duly
[C]Manhood [G]taken [D]by the [G]Son.`),

  S('laudate-dominum', 'Laudate Dominum (Psalm 117)', 'G', 'Entrance', `
{Verse}
Lau[G]date Dominum, [C]omnes [G]gentes;
lau[Em]date eum, [A]omnes [D]populi.
[G]Quoniam confir[C]mata est super [G]nos
mise[Em]ricordia [C]eius,
et [G]veritas Domini [D]manet in ae[G]ternum.`),

  S('let-all-mortal-flesh', 'Let All Mortal Flesh Keep Silence', 'Dm', 'Offertory', `
{Verse 1}
[Dm]Let all mortal [C]flesh keep [Dm]silence,
[Dm]And with fear and [C]trembling [Dm]stand;
[F]Ponder nothing [C]earthly-[Dm]minded,
[Dm]For with blessing [C]in His [Dm]hand
[F]Christ our God to [C]earth de[F]scendeth,
[Dm]Our full [C]homage [A]to de[Dm]mand.`),

  // ---- Eucharist ----
  S('lord-who-at-thy-first-eucharist', 'Lord, Who at Thy First Eucharist', 'G', 'Communion', `
{Verse 1}
[G]Lord, who at Thy first [D]Eucharist didst [G]pray
That [C]all Thy Church might [G]be for ever [D]one,
[G]Grant us at every [Em]Eucharist to [Bm]say
With [C]longing heart and [G]soul, "Thy [D]will be [G]done."
O [C]may we all one [G]bread, one body [D]be,
[G]Through this blest [C]sacra[G]ment of [D]uni[G]ty.`),

  S('o-saving-victim', 'O Saving Victim', 'D', 'Communion', `
{Verse 1}
O [D]saving Victim, [G]opening [D]wide
The [A]gate of heaven to [D]all be[A]low;
Our [D]foes press on from [G]every [D]side;
Thine [G]aid sup[D]ply, Thy [A]strength be[D]stow.`),

  S('down-in-adoration', 'Down in Adoration Falling', 'D', 'Communion', `
{Verse 1}
[D]Down in ado[A]ration [D]falling,
[G]Lo! the sacred [A]Host we [D]hail;
[D]Lo! o'er ancient [A]forms de[Bm]parting,
[G]Newer rites of [A]grace pre[D]vail;
[G]Faith for all de[D]fects sup[A]plying,
[D]Where the [G]feeble [A]senses [D]fail.`),

  S('pange-lingua', 'Pange Lingua', 'D', 'Communion', `
{Verse 1}
[D]Pange, lingua, [G]glori[D]osi
[A]Corporis mys[D]terium,
[D]Sanguinisque [G]preti[D]osi,
[A]quem in mundi [D]pretium
[G]fructus ventris [D]gene[A]rosi
[D]Rex ef[G]fudit [A]genti[D]um.`),

  S('sweet-saviour-bless-us', 'Sweet Saviour, Bless Us Ere We Go', 'G', 'Recessional', `
{Verse 1}
[G]Sweet Saviour, bless us [C]ere we [G]go;
Thy [D]word into our [G]minds in[D]stil,
And [G]make our lukewarm [C]hearts to [G]glow
With [Em]lowly [C]love and [D]fervent will.
{Refrain}
[G]Through life's long day and [C]death's dark [G]night,
O [C]gentle [G]Jesus, [D]be our [G]light.`),

  // ---- Our Lady ----
  S('mother-dearest', 'Mother Dearest, Mother Fairest', 'F', 'Marian', `
{Verse 1}
[F]Mother dearest, [C]Mother [F]fairest,
[Bb]Help of all who [F]call on [C]thee,
[F]Virgin purest, [C]brightest, [Dm]rarest,
[Bb]Help us, [F]help, we [C]cry to [F]thee.
{Refrain}
[F]Mary, help us, [Bb]help we [F]pray;
[F]Mary, help us, [C]help we [F]pray;
[Bb]Help us in all [F]care and [C]sorrow;
[F]Mary, help us, [C]help we [F]pray.`),

  S('on-this-day-o-beautiful-mother', 'On This Day, O Beautiful Mother', 'F', 'Marian', `
{Refrain}
On this [F]day, O beautiful [C]Mother,
On this [C7]day we give thee our [F]love.
[F]Near thee, Ma[Bb]donna, fondly we [F]hover,
[F]Trusting thy [C]gentle care to [F]prove.`),

  S('ill-sing-a-hymn-to-mary', "I'll Sing a Hymn to Mary", 'G', 'Marian', `
{Verse 1}
I'll [G]sing a hymn to [C]Mary, the [G]Mother of my [D]God,
The [G]Virgin of all [C]virgins, of [G]David's [D]royal [G]blood.
O [C]teach me, holy [G]Mary, a [Em]loving song to [D]frame,
When [G]wicked men blas[C]pheme thee, to [G]love and [D]bless thy [G]name.`),
];
