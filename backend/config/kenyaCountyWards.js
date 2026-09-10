// Wards nested under each county's constituencies (the same 47
// counties / 290 constituencies as KENYA_COUNTY_AREAS in this same
// directory — every constituency key here matches that file's
// KENYA_COUNTY_AREAS[county] entries exactly, verified 1:1, so a
// lookup by [county][constituency] never misses).
//
// Sourced from a CSV (github.com/pkiage/data-Kenya-Counties-Constituencies-Wards)
// independently cross-validated against a second, separately-sourced CSV
// (github.com/warrenshiv/Counties-County-Sub-county-wards-in-Kenya), both
// citing the IEBC 2012 delimitation's official constituencies-and-wards
// document (National Assembly) — 2026-09-10. 47 counties, 290
// constituencies, 1,450 wards, no gaps.
//
// A handful of constituency names needed reconciling against this
// county's external spelling (Mt.Elgon -> Mount Elgon, Lungalunga ->
// Lunga Lunga, Langata -> Lang'ata, Chuka/Igambang'om ->
// Chuka/Igambang'ombe) — and one real split: the source used the
// pre-rename labels 'Mbita'/'Suba' for what are now Homa Bay's Suba
// North (Mbita town, the island wards) and Suba South (the Gwassi/
// Kaksingri mainland wards) constituencies — remapped accordingly.
export const KENYA_COUNTY_WARDS = {
  "Baringo": {
    "Tiaty": [
      "Tirioko",
      "Kolowa",
      "Ribkwo",
      "Silale",
      "Loiyamorock",
      "Tangulbei/Korossi",
      "Churo/Amaya"
    ],
    "Baringo North": [
      "Barwessa",
      "Kabartonjo",
      "Saimo/Kipsaraman",
      "Saimo/Soi",
      "Bartabwa"
    ],
    "Baringo Central": [
      "Kabarnet",
      "Sacho",
      "Tenges",
      "Ewalel Chapchap",
      "Kapropita"
    ],
    "Baringo South": [
      "Marigat",
      "Ilchamus",
      "Mochongoi",
      "Mukutani"
    ],
    "Mogotio": [
      "Mogotio",
      "Emining",
      "Kisanana"
    ],
    "Eldama Ravine": [
      "Lembus",
      "Lembus Kwen",
      "Ravine",
      "Mumberes/Maji Mazuri",
      "Lembus/Perkerra",
      "Koibatek"
    ]
  },
  "Bomet": {
    "Sotik": [
      "Ndanai/Abosi",
      "Chemagel",
      "Kipsonoi",
      "Kapletundo",
      "Rongena/Manaret"
    ],
    "Chepalungu": [
      "Kong'Asis",
      "Nyangores",
      "Sigor",
      "Chebunyo",
      "Siongiroi"
    ],
    "Bomet East": [
      "Merigi",
      "Kembu",
      "Longisa",
      "Kipreres",
      "Chemaner"
    ],
    "Bomet Central": [
      "Silibwet Township",
      "Ndaraweta",
      "Singorwet",
      "Chesoen",
      "Mutarakwa"
    ],
    "Konoin": [
      "Chepchabas",
      "Kimulot",
      "Mogogosiek",
      "Boito",
      "Embomos"
    ]
  },
  "Bungoma": {
    "Mount Elgon": [
      "Cheptais",
      "Chesikaki",
      "Chepyuk",
      "Kapkateny",
      "Kaptama",
      "Elgon"
    ],
    "Sirisia": [
      "Namwela",
      "Malakisi/South Kulisiru",
      "Lwandanyi"
    ],
    "Kabuchai": [
      "Kabuchai/Chwele",
      "West Nalondo",
      "Bwake/Luuya",
      "Mukuyuni"
    ],
    "Bumula": [
      "South Bukusu",
      "Bumula",
      "Khasoko",
      "Kabula",
      "Kimaeti",
      "West Bukusu",
      "Siboti"
    ],
    "Kanduyi": [
      "Bukembe West",
      "Bukembe East",
      "Township",
      "Khalaba",
      "Musikoma",
      "East Sang'Alo",
      "Marakaru/Tuuti",
      "Sang'Alo West"
    ],
    "Webuye East": [
      "Mihuu",
      "Ndivisi",
      "Maraka"
    ],
    "Webuye West": [
      "Misikhu",
      "Sitikho",
      "Matulo",
      "Bokoli"
    ],
    "Kimilili": [
      "Kimilili",
      "Kibingei",
      "Maeni",
      "Kamukuywa"
    ],
    "Tongaren": [
      "Mbakalo",
      "Naitiri/Kabuyefwe",
      "Milima",
      "Ndalu/ Tabani",
      "Tongaren",
      "Soysambu/ Mitua"
    ]
  },
  "Busia": {
    "Teso North": [
      "Malaba Central",
      "Malaba North",
      "Ang'Urai South",
      "Ang'Urai North",
      "Ang'Urai East",
      "Malaba South"
    ],
    "Teso South": [
      "Ang'Orom",
      "Chakol South",
      "Chakol North",
      "Amukura West",
      "Amukura East",
      "Amukura Central"
    ],
    "Nambale": [
      "Nambale Township",
      "Bukhayo North/Waltsi",
      "Bukhayo East",
      "Bukhayo Central"
    ],
    "Matayos": [
      "Bukhayo West",
      "Mayenje",
      "Matayos South",
      "Busibwabo",
      "Burumba"
    ],
    "Butula": [
      "Marachi West",
      "Kingandole",
      "Marachi Central",
      "Marachi East",
      "Marachi North",
      "Elugulu"
    ],
    "Funyula": [
      "Namboboto Nambuku",
      "Nangina",
      "Ageng'A Nanguba",
      "Bwiri"
    ],
    "Budalangi": [
      "Bunyala Central",
      "Bunyala North",
      "Bunyala West",
      "Bunyala South"
    ]
  },
  "Elgeyo-Marakwet": {
    "Marakwet East": [
      "Kapyego",
      "Sambirir",
      "Endo",
      "Embobut / Embulot"
    ],
    "Marakwet West": [
      "Lelan",
      "Sengwer",
      "Cherang'any/Chebororwa",
      "Moiben/Kuserwo",
      "Kapsowar",
      "Arror"
    ],
    "Keiyo North": [
      "Emsoo",
      "Kamariny",
      "Kapchemutwa",
      "Tambach"
    ],
    "Keiyo South": [
      "Kaptarakwa",
      "Chepkorio",
      "Soy North",
      "Soy South",
      "Kabiemit",
      "Metkei"
    ]
  },
  "Embu": {
    "Manyatta": [
      "Ruguru/Ngandori",
      "Kithimu",
      "Nginda",
      "Mbeti North",
      "Kirimari",
      "Gaturi South"
    ],
    "Runyenjes": [
      "Gaturi North",
      "Kagaari South",
      "Central  Ward",
      "Kagaari North",
      "Kyeni North",
      "Kyeni South"
    ],
    "Mbeere South": [
      "Mwea",
      "Makima",
      "Mbeti South",
      "Mavuria",
      "Kiambere"
    ],
    "Mbeere North": [
      "Nthawa",
      "Muminji",
      "Evurore"
    ]
  },
  "Garissa": {
    "Garissa Township": [
      "Waberi",
      "Galbet",
      "Township",
      "Iftin"
    ],
    "Balambala": [
      "Balambala",
      "Danyere",
      "Jara Jara",
      "Saka",
      "Sankuri"
    ],
    "Lagdera": [
      "Modogashe",
      "Benane",
      "Goreale",
      "Maalimin",
      "Sabena",
      "Baraki"
    ],
    "Dadaab": [
      "Dertu",
      "Dadaab",
      "Labasigale",
      "Damajale",
      "Liboi",
      "Abakaile"
    ],
    "Fafi": [
      "Bura",
      "Dekaharia",
      "Jarajila",
      "Fafi",
      "Nanighi"
    ],
    "Ijara": [
      "Hulugho",
      "Sangailu",
      "Ijara",
      "Masalani"
    ]
  },
  "Homa Bay": {
    "Kasipul": [
      "West Kasipul",
      "South Kasipul",
      "Central Kasipul",
      "East Kamagak",
      "West Kamagak"
    ],
    "Kabondo Kasipul": [
      "Kabondo East",
      "Kabondo West",
      "Kokwanyo/Kakelo",
      "Kojwach"
    ],
    "Karachuonyo": [
      "West Karachuonyo",
      "North Karachuonyo",
      "Central",
      "Kanyaluo",
      "Kibiri",
      "Wangchieng",
      "Kendu Bay Town"
    ],
    "Rangwe": [
      "West Gem",
      "East Gem",
      "Kagan",
      "Kochia"
    ],
    "Homa Bay Town": [
      "Homa Bay Central",
      "Homa Bay Arujo",
      "Homa Bay West",
      "Homa Bay East"
    ],
    "Ndhiwa": [
      "Kwabwai",
      "Kanyadoto",
      "Kanyikela",
      "North Kabuoch",
      "Kabuoch South/Pala",
      "Kanyamwa Kologi",
      "Kanyamwa Kosewe"
    ],
    "Suba North": [
      "Mfangano Island",
      "Rusinga Island",
      "Kasgunga",
      "Gembe",
      "Lambwe"
    ],
    "Suba South": [
      "Gwassi South",
      "Gwassi North",
      "Kaksingri West",
      "Ruma Kaksingri East"
    ]
  },
  "Isiolo": {
    "Isiolo North": [
      "Wabera",
      "Bulla Pesa",
      "Chari",
      "Cherab",
      "Ngare Mara",
      "Burat",
      "Oldonyiro"
    ],
    "Isiolo South": [
      "Garbatulla",
      "Kinna",
      "Sericho"
    ]
  },
  "Kajiado": {
    "Kajiado North": [
      "Olkeri",
      "Ongata Rongai",
      "Nkaimurunya",
      "Oloolua",
      "Ngong"
    ],
    "Kajiado Central": [
      "Purko",
      "Ildamat",
      "Dalalekutuk",
      "Matapato North",
      "Matapato South"
    ],
    "Kajiado East": [
      "Kaputiei North",
      "Kitengela",
      "Oloosirkon/Sholinke",
      "Kenyawa-poka",
      "Imaroro"
    ],
    "Kajiado West": [
      "Keekonyokie",
      "Iloodokilani",
      "Magadi",
      "Ewuaso Oonkidong'I",
      "Mosiro"
    ],
    "Kajiado South": [
      "Entonet/Lenkisim",
      "Mbirikani/Eselenkei",
      "Kuku",
      "Rombo",
      "Kimana"
    ]
  },
  "Kakamega": {
    "Lugari": [
      "Mautuma",
      "Lugari",
      "Lumakanda",
      "Chekalini",
      "Chevaywa",
      "Lwandeti"
    ],
    "Likuyani": [
      "Likuyani",
      "Sango",
      "Kongoni",
      "Nzoia",
      "Sinoko"
    ],
    "Malava": [
      "West Kabras",
      "Chemuche",
      "East Kabras",
      "Butali/Chegulo",
      "Manda-shivanga",
      "Shirugu-mugai",
      "South Kabras"
    ],
    "Lurambi": [
      "Butsotso East",
      "Butsotso South",
      "Butsotso Central",
      "Sheywe",
      "Mahiakalo",
      "Shirere"
    ],
    "Navakholo": [
      "Ingostse-mathia",
      "Shinoyi-shikomari-",
      "Bunyala West",
      "Bunyala East",
      "Bunyala Central"
    ],
    "Mumias West": [
      "Mumias Central",
      "Mumias North",
      "Etenje",
      "Musanda"
    ],
    "Mumias East": [
      "Lubinu/Lusheya",
      "Isongo/Makunga/Malaha",
      "East Wanga"
    ],
    "Matungu": [
      "Koyonzo",
      "Kholera",
      "Khalaba",
      "Mayoni",
      "Namamali"
    ],
    "Butere": [
      "Marama West",
      "Marama Central",
      "Marenyo - Shianda",
      "Marama North",
      "Marama South"
    ],
    "Khwisero": [
      "Kisa North",
      "Kisa East",
      "Kisa West",
      "Kisa Central"
    ],
    "Shinyalu": [
      "Isukha North",
      "Murhanda",
      "Isukha Central",
      "Isukha South",
      "Isukha East",
      "Isukha West"
    ],
    "Ikolomani": [
      "Idakho South",
      "Idakho East",
      "Idakho North",
      "Idakho Central"
    ]
  },
  "Kericho": {
    "Kipkelion East": [
      "Londiani",
      "Kedowa/Kimugul",
      "Chepseon",
      "Tendeno/Sorget"
    ],
    "Kipkelion West": [
      "Kunyak",
      "Kamasian",
      "Kipkelion",
      "Chilchila"
    ],
    "Ainamoi": [
      "Kapsoit",
      "Ainamoi",
      "Kapkugerwet",
      "Kipchebor",
      "Kipchimchim",
      "Kapsaos"
    ],
    "Bureti": [
      "Kisiara",
      "Tebesonik",
      "Cheboin",
      "Chemosot",
      "Litein",
      "Cheplanget",
      "Kapkatet"
    ],
    "Belgut": [
      "Waldai",
      "Kabianga",
      "Cheptororiet/Seretut",
      "Chaik",
      "Kapsuser"
    ],
    "Sigowet-Soin": [
      "Sigowet",
      "Kaplelartet",
      "Soliat",
      "Soin"
    ]
  },
  "Kiambu": {
    "Gatundu South": [
      "Kiamwangi",
      "Kiganjo",
      "Ndarugu",
      "Ngenda"
    ],
    "Gatundu North": [
      "Gituamba",
      "Githobokoni",
      "Chania",
      "Mang'U"
    ],
    "Juja": [
      "Murera",
      "Theta",
      "Juja",
      "Witeithie",
      "Kalimoni"
    ],
    "Thika Town": [
      "Township",
      "Kamenu",
      "Hospital",
      "Gatuanyaga",
      "Ngoliba"
    ],
    "Ruiru": [
      "Gitothua",
      "Biashara",
      "Gatongora",
      "Kahawa Sukari",
      "Kahawa Wendani",
      "Kiuu",
      "Mwiki",
      "Mwihoko"
    ],
    "Githunguri": [
      "Githunguri",
      "Githiga",
      "Ikinu",
      "Ngewa",
      "Komothai"
    ],
    "Kiambu": [
      "Ting'Ang'A",
      "Ndumberi",
      "Riabai",
      "Township"
    ],
    "Kiambaa": [
      "Cianda",
      "Karuri",
      "Ndenderu",
      "Muchatha",
      "Kihara"
    ],
    "Kabete": [
      "Gitaru",
      "Muguga",
      "Nyadhuna",
      "Kabete",
      "Uthiru"
    ],
    "Kikuyu": [
      "Karai",
      "Nachu",
      "Sigona",
      "Kikuyu",
      "Kinoo"
    ],
    "Limuru": [
      "Bibirioni",
      "Limuru Central",
      "Ndeiya",
      "Limuru East",
      "Ngecha Tigoni"
    ],
    "Lari": [
      "Kinale",
      "Kijabe",
      "Nyanduma",
      "Kamburu",
      "Lari/Kirenga"
    ]
  },
  "Kilifi": {
    "Kilifi North": [
      "Tezo",
      "Sokoni",
      "Kibarani",
      "Dabaso",
      "Matsangoni",
      "Watamu",
      "Mnarani"
    ],
    "Kilifi South": [
      "Junju",
      "Mwarakaya",
      "Shimo La Tewa",
      "Chasimba",
      "Mtepeni"
    ],
    "Kaloleni": [
      "Mariakani",
      "Kayafungo",
      "Kaloleni",
      "Mwanamwinga"
    ],
    "Rabai": [
      "Mwawesa",
      "Ruruma",
      "Kambe/Ribe",
      "Rabai/Kisurutini"
    ],
    "Ganze": [
      "Ganze",
      "Bamba",
      "Jaribuni",
      "Sokoke"
    ],
    "Malindi": [
      "Jilore",
      "Kakuyuni",
      "Ganda",
      "Malindi Town",
      "Shella"
    ],
    "Magarini": [
      "Marafa",
      "Magarini",
      "Gongoni",
      "Adu",
      "Garashi",
      "Sabaki"
    ]
  },
  "Kirinyaga": {
    "Mwea": [
      "Mutithi",
      "Kangai",
      "Thiba",
      "Wamumu",
      "Nyangati",
      "Murinduko",
      "Gathigiriri",
      "Tebere"
    ],
    "Gichugu": [
      "Kabare",
      "Baragwi",
      "Njukiini",
      "Ngariama",
      "Karumandi"
    ],
    "Ndia": [
      "Mukure",
      "Kiine",
      "Kariti"
    ],
    "Kirinyaga Central": [
      "Mutira",
      "Kanyeki-ini",
      "Kerugoya",
      "Inoi"
    ]
  },
  "Kisii": {
    "Bonchari": [
      "Bomariba",
      "Bogiakumu",
      "Bomorenda",
      "Riana"
    ],
    "South Mugirango": [
      "Tabaka",
      "Boikang'A",
      "Bogetenga",
      "Borabu / Chitago",
      "Moticho",
      "Getenga"
    ],
    "Bomachoge Borabu": [
      "Bombaba Borabu",
      "Boochi Borabu",
      "Bokimonge",
      "Magenche"
    ],
    "Bobasi": [
      "Masige West",
      "Masige East",
      "Bobasi Central",
      "Nyacheki",
      "Bobasi Bogetaorio",
      "Bobasi Chache",
      "Sameta/Mokwerero",
      "Bobasi Boitangare"
    ],
    "Bomachoge Chache": [
      "Majoge",
      "Boochi/Tendere",
      "Bosoti/Sengera"
    ],
    "Nyaribari Masaba": [
      "Ichuni",
      "Nyamasibi",
      "Masimba",
      "Gesusu",
      "Kiamokama"
    ],
    "Nyaribari Chache": [
      "Bobaracho",
      "Kisii Central",
      "Keumbu",
      "Kiogoro",
      "Birongo",
      "Ibeno"
    ],
    "Kitutu Chache North": [
      "Monyerero",
      "Sensi",
      "Marani",
      "Kegogi"
    ],
    "Kitutu Chache South": [
      "Bogusero",
      "Bogeka",
      "Nyakoe",
      "Kitutu   Central",
      "Nyatieko"
    ]
  },
  "Kisumu": {
    "Kisumu East": [
      "Kajulu",
      "Kolwa East",
      "Manyatta 'B'",
      "Nyalenda 'A'",
      "Kolwa Central"
    ],
    "Kisumu West": [
      "South West Kisumu",
      "Central Kisumu",
      "Kisumu North",
      "West Kisumu",
      "North West Kisumu"
    ],
    "Kisumu Central": [
      "Railways",
      "Migosi",
      "Shaurimoyo Kaloleni",
      "Market Milimani",
      "Kondele",
      "Nyalenda B"
    ],
    "Seme": [
      "West Seme",
      "Central Seme",
      "East Seme",
      "North Seme"
    ],
    "Nyando": [
      "East Kano/Wawidhi",
      "Awasi/Onjiko",
      "Ahero",
      "Kabonyo/Kanyagwal",
      "Kobura"
    ],
    "Muhoroni": [
      "Miwani",
      "Ombeyi",
      "Masogo/Nyang'oma",
      "Chemelil",
      "Muhoroni/Koru"
    ],
    "Nyakach": [
      "South West Nyakach",
      "North Nyakach",
      "Central Nyakach",
      "West Nyakach",
      "South East Nyakach"
    ]
  },
  "Kitui": {
    "Mwingi North": [
      "Ngomeni",
      "Kyuso",
      "Mumoni",
      "Tseikuru",
      "Tharaka"
    ],
    "Mwingi West": [
      "Kyome/Thaana",
      "Nguutani",
      "Migwani",
      "Kiomo/Kyethani"
    ],
    "Mwingi Central": [
      "Central",
      "Kivou",
      "Nguni",
      "Nuu",
      "Mui",
      "Waita"
    ],
    "Kitui West": [
      "Mutonguni",
      "Kauwi",
      "Matinyani",
      "Kwa Mutonga/Kithumula"
    ],
    "Kitui Rural": [
      "Kisasi",
      "Mbitini",
      "Kwavonza/Yatta",
      "Kanyangi"
    ],
    "Kitui Central": [
      "Miambani",
      "Township",
      "Kyangwithya West",
      "Mulango",
      "Kyangwithya East"
    ],
    "Kitui East": [
      "Zombe/Mwitika",
      "Chuluni",
      "Nzambani",
      "Voo/Kyamatu",
      "Endau/Malalani",
      "Mutito/Kaliku"
    ],
    "Kitui South": [
      "Ikanga/Kyatune",
      "Mutomo",
      "Mutha",
      "Ikutha",
      "Kanziko",
      "Athi"
    ]
  },
  "Kwale": {
    "Msambweni": [
      "Gombatobongwe",
      "Ukunda",
      "Kinondo",
      "Ramisi"
    ],
    "Lunga Lunga": [
      "Pongwekikoneni",
      "Dzombo",
      "Mwereni",
      "Vanga"
    ],
    "Matuga": [
      "Tsimba Golini",
      "Waa",
      "Tiwi",
      "Kubo South",
      "Mkongani"
    ],
    "Kinango": [
      "Nadavaya",
      "Puma",
      "Kinango",
      "Mackinnon-road",
      "Chengoni/Samburu",
      "Mwavumbo",
      "Kasemeni"
    ]
  },
  "Laikipia": {
    "Laikipia West": [
      "Olmoran",
      "Rumuruti Township",
      "Kinamba",
      "Marmanet",
      "Igwamiti",
      "Salama"
    ],
    "Laikipia East": [
      "Ngobit",
      "Tigithi",
      "Thingithu",
      "Nanyuki",
      "Umande"
    ],
    "Laikipia North": [
      "Sosian",
      "Segera",
      "Mukogondo West",
      "Mukogondo East"
    ]
  },
  "Lamu": {
    "Lamu East": [
      "Faza",
      "Kiunga",
      "Basuba"
    ],
    "Lamu West": [
      "Shella",
      "Mkomani",
      "Hindi",
      "Mkunumbi",
      "Hongwe",
      "Witu",
      "Bahari"
    ]
  },
  "Machakos": {
    "Masinga": [
      "Kivaa",
      "Masinga Central",
      "Ekalakala",
      "Muthesya",
      "Ndithini"
    ],
    "Yatta": [
      "Ndalani",
      "Matuu",
      "Kithimani",
      "Ikombe",
      "Katangi"
    ],
    "Kangundo": [
      "Kangundo North",
      "Kangundo Central",
      "Kangundo East",
      "Kangundo West"
    ],
    "Matungulu": [
      "Tala",
      "Matungulu North",
      "Matungulu East",
      "Matungulu West",
      "Kyeleni"
    ],
    "Kathiani": [
      "Mitaboni",
      "Kathiani Central",
      "Upper Kaewa/Iveti",
      "Lower Kaewa/Kaani"
    ],
    "Mavoko": [
      "Athi River",
      "Kinanie",
      "Muthwani",
      "Syokimau/Mulolongo"
    ],
    "Machakos Town": [
      "Kalama",
      "Mua",
      "Mutituni",
      "Machakos Central",
      "Mumbuni North",
      "Muvuti/Kiima-kimwe",
      "Kola"
    ],
    "Mwala": [
      "Mbiuni",
      "Makutano/ Mwala",
      "Masii",
      "Muthetheni",
      "Wamunyu",
      "Kibauni"
    ]
  },
  "Makueni": {
    "Mbooni": [
      "Tulimani",
      "Mbooni",
      "Kithungo/Kitundu",
      "Kisau/Kiteta",
      "Waia/Kako",
      "Kalawa"
    ],
    "Kilome": [
      "Kasikeu",
      "Mukaa",
      "Kiima Kiu/Kalanzoni"
    ],
    "Kaiti": [
      "Ukia",
      "Kee",
      "Kilungu",
      "Ilima"
    ],
    "Makueni": [
      "Wote",
      "Muvau/Kikuumini",
      "Mavindini",
      "Kitise/Kithuki",
      "Kathonzweni",
      "Nzaui/Kilili/Kalamba",
      "Mbitini"
    ],
    "Kibwezi West": [
      "Makindu",
      "Nguumo",
      "Kikumbulyu North",
      "Kikumbulyu South",
      "Nguu/Masumba",
      "Emali/Mulala"
    ],
    "Kibwezi East": [
      "Masongaleni",
      "Mtito Andei",
      "Thange",
      "Ivingoni/Nzambani"
    ]
  },
  "Mandera": {
    "Mandera West": [
      "Takaba South",
      "Takaba",
      "Lag Sure",
      "Dandu",
      "Gither"
    ],
    "Banissa": [
      "Banissa",
      "Derkhale",
      "Guba",
      "Malkamari",
      "Kiliwehiri"
    ],
    "Mandera North": [
      "Ashabito",
      "Guticha",
      "Morothile",
      "Rhamu",
      "Rhamu-dimtu"
    ],
    "Mandera South": [
      "Wargudud",
      "Kutulo",
      "Elwak South",
      "Elwak North",
      "Shimbir Fatuma"
    ],
    "Mandera East": [
      "Arabia",
      "Bulla Mpya",
      "Khalalio",
      "Neboi",
      "Township"
    ],
    "Lafey": [
      "Libehia",
      "Fino",
      "Lafey",
      "Warankara",
      "Alungo Gof"
    ]
  },
  "Marsabit": {
    "Moyale": [
      "Butiye",
      "Sololo",
      "Heilu-manyatta",
      "Golbo",
      "Moyale Township",
      "Uran",
      "Obbu"
    ],
    "North Horr": [
      "Illeret",
      "North Horr",
      "Dukana",
      "Maikona",
      "Turbi"
    ],
    "Saku": [
      "Sagante/Jaldesa",
      "Karare",
      "Marsabit Central"
    ],
    "Laisamis": [
      "Loiyangalani",
      "Kargi/South Horr",
      "Korr/Ngurunit",
      "Log Logo",
      "Laisamis"
    ]
  },
  "Meru": {
    "Igembe South": [
      "Maua",
      "Kiegoi/Antubochiu",
      "Athiru Gaiti",
      "Akachiu",
      "Kanuni"
    ],
    "Igembe Central": [
      "Akirang'Ondu",
      "Athiru Ruujine",
      "Igembe East",
      "Njia",
      "Kangeta"
    ],
    "Igembe North": [
      "Antuambui",
      "Ntunene",
      "Antubetwe Kiongo",
      "Naathu",
      "Amwathi"
    ],
    "Tigania West": [
      "Athwana",
      "Akithii",
      "Kianjai",
      "Nkomo",
      "Mbeu"
    ],
    "Tigania East": [
      "Thangatha",
      "Mikinduri",
      "Kiguchwa",
      "Muthara",
      "Karama"
    ],
    "North Imenti": [
      "Municipality",
      "Ntima East",
      "Ntima West",
      "Nyaki West",
      "Nyaki East"
    ],
    "Buuri": [
      "Timau",
      "Kisima",
      "Kiirua/Naari",
      "Ruiri/Rwarera",
      "Kibirichia"
    ],
    "Central Imenti": [
      "Mwanganthia",
      "Abothuguchi Central",
      "Abothuguchi West",
      "Kiagu"
    ],
    "South Imenti": [
      "Mitunguu",
      "Igoji East",
      "Igoji West",
      "Abogeta East",
      "Abogeta West",
      "Nkuene"
    ]
  },
  "Migori": {
    "Rongo": [
      "North Kamagambo",
      "Central Kamagambo",
      "East Kamagambo",
      "South Kamagambo"
    ],
    "Awendo": [
      "North Sakwa",
      "South Sakwa",
      "West Sakwa",
      "Central Sakwa"
    ],
    "Suna East": [
      "God Jope",
      "Suna Central",
      "Kakrao",
      "Kwa"
    ],
    "Suna West": [
      "Wiga",
      "Wasweta Ii",
      "Ragana-oruba",
      "Wasimbete"
    ],
    "Uriri": [
      "West Kanyamkago",
      "North Kanyamkago",
      "Central Kanyamkago",
      "South Kanyamkago",
      "East Kanyamkago"
    ],
    "Nyatike": [
      "Kachien'G",
      "Kanyasa",
      "North Kadem",
      "Macalder/Kanyarwanda",
      "Kaler",
      "Got Kachola",
      "Muhuru"
    ],
    "Kuria West": [
      "Bukira East",
      "Bukira Centrl/Ikerege",
      "Isibania",
      "Makerero",
      "Masaba",
      "Tagare",
      "Nyamosense/Komosoko"
    ],
    "Kuria East": [
      "Gokeharaka/Getambwega",
      "Ntimaru West",
      "Ntimaru East",
      "Nyabasi East",
      "Nyabasi West"
    ]
  },
  "Mombasa": {
    "Changamwe": [
      "Port Reitz",
      "Kipevu",
      "Airport",
      "Changamwe",
      "Chaani"
    ],
    "Jomvu": [
      "Jomvu Kuu",
      "Miritini",
      "Mikindani"
    ],
    "Kisauni": [
      "Mjambere",
      "Junda",
      "Bamburi",
      "Mwakirunge",
      "Mtopanga",
      "Magogoni",
      "Shanzu"
    ],
    "Nyali": [
      "Frere Town",
      "Ziwa La Ng'Ombe",
      "Mkomani",
      "Kongowea",
      "Kadzandani"
    ],
    "Likoni": [
      "Mtongwe",
      "Shika Adabu",
      "Bofu",
      "Likoni",
      "Timbwani"
    ],
    "Mvita": [
      "Mji Wa Kale/Makadara",
      "Tudor",
      "Tononoka",
      "Shimanzi/Ganjoni",
      "Majengo"
    ]
  },
  "Murang'a": {
    "Kangema": [
      "Kanyenyaini",
      "Muguru",
      "Rwathia"
    ],
    "Mathioya": [
      "Gitugi",
      "Kiru",
      "Kamacharia"
    ],
    "Kiharu": [
      "Wangu",
      "Mugoiri",
      "Mbiri",
      "Township",
      "Murarandia",
      "Gaturi"
    ],
    "Kigumo": [
      "Kahumbu",
      "Muthithi",
      "Kigumo",
      "Kangari",
      "Kinyona"
    ],
    "Maragwa": [
      "Kimorori/Wempa",
      "Makuyu",
      "Kambiti",
      "Kamahuha",
      "Ichagaki",
      "Nginda"
    ],
    "Kandara": [
      "Ng'Araria",
      "Muruka",
      "Kagundu-ini",
      "Gaichanjiru",
      "Ithiru",
      "Ruchu"
    ],
    "Gatanga": [
      "Ithanga",
      "Kakuzi/Mitubiri",
      "Mugumo-ini",
      "Kihumbu-ini",
      "Gatanga",
      "Kariara"
    ]
  },
  "Nairobi": {
    "Westlands": [
      "Kitisuru",
      "Parklands/Highridge",
      "Karura",
      "Kangemi",
      "Mountain View"
    ],
    "Dagoretti North": [
      "Kilimani",
      "Kawangware",
      "Gatina",
      "Kileleshwa",
      "Kabiro"
    ],
    "Dagoretti South": [
      "Mutuini",
      "Ngando",
      "Riruta",
      "Uthiru/Ruthimitu",
      "Waithaka"
    ],
    "Lang'ata": [
      "Karen",
      "Nairobi West",
      "Mugumo-ini",
      "South-c",
      "Nyayo Highrise"
    ],
    "Kibra": [
      "Laini Saba",
      "Lindi",
      "Makina",
      "Woodley/Kenyatta Golf",
      "Sarangombe"
    ],
    "Roysambu": [
      "Githurai",
      "Kahawa West",
      "Zimmerman",
      "Roysambu",
      "Kahawa"
    ],
    "Kasarani": [
      "Claycity",
      "Mwiki",
      "Kasarani",
      "Njiru",
      "Ruai"
    ],
    "Ruaraka": [
      "Baba Dogo",
      "Utalii",
      "Mathare North",
      "Lucky Summer",
      "Korogocho"
    ],
    "Embakasi South": [
      "Imara Daima",
      "Kwa Njenga",
      "Kwa Reuben",
      "Pipeline",
      "Kware"
    ],
    "Embakasi North": [
      "Kariobangi North",
      "Dandora Area I",
      "Dandora Area Ii",
      "Dandora Area Iii",
      "Dandora Area Iv"
    ],
    "Embakasi Central": [
      "Kayole North",
      "Kayole Central",
      "Kayole South",
      "Komarock",
      "Matopeni"
    ],
    "Embakasi East": [
      "Upper Savannah",
      "Lower Savannah",
      "Embakasi",
      "Utawala",
      "Mihango"
    ],
    "Embakasi West": [
      "Umoja I",
      "Umoja Ii",
      "Mowlem",
      "Kariobangi South"
    ],
    "Makadara": [
      "Makongeni",
      "Maringo/Hamza",
      "Harambee",
      "Viwandani"
    ],
    "Kamukunji": [
      "Pumwani",
      "Eastleigh North",
      "Eastleigh South",
      "Airbase",
      "California"
    ],
    "Starehe": [
      "Nairobi Central",
      "Ngara",
      "Ziwani/Kariokor",
      "Pangani",
      "Landimawe",
      "Nairobi South"
    ],
    "Mathare": [
      "Hospital",
      "Mabatini",
      "Huruma",
      "Ngei",
      "Mlango Kubwa",
      "Kiamaiko"
    ]
  },
  "Nakuru": {
    "Molo": [
      "Mariashoni",
      "Elburgon",
      "Turi",
      "Molo"
    ],
    "Njoro": [
      "Maunarok",
      "Mauche",
      "Kihingo",
      "Nessuit",
      "Lare",
      "Njoro"
    ],
    "Naivasha": [
      "Biashara",
      "Hells Gate",
      "Lakeview",
      "Maai-mahiu",
      "Maiella",
      "Olkaria",
      "Naivasha East",
      "Viwandani"
    ],
    "Gilgil": [
      "Gilgil",
      "Elementaita",
      "Mbaruk/Eburu",
      "Malewa West",
      "Murindati"
    ],
    "Kuresoi South": [
      "Amalo",
      "Keringet",
      "Kiptagich",
      "Tinet"
    ],
    "Kuresoi North": [
      "Kiptororo",
      "Nyota",
      "Sirikwa",
      "Kamara"
    ],
    "Subukia": [
      "Subukia",
      "Waseges",
      "Kabazi"
    ],
    "Rongai": [
      "Menengai West",
      "Soin",
      "Visoi",
      "Mosop",
      "Solai"
    ],
    "Bahati": [
      "Dundori",
      "Kabatini",
      "Kiamaina",
      "Lanet/Umoja",
      "Bahati"
    ],
    "Nakuru Town West": [
      "Barut",
      "London",
      "Kaptembwo",
      "Kapkures",
      "Rhoda",
      "Shaabab"
    ],
    "Nakuru Town East": [
      "Biashara",
      "Kivumbini",
      "Flamingo",
      "Menengai",
      "Nakuru East"
    ]
  },
  "Nandi": {
    "Tinderet": [
      "Songhor/Soba",
      "Tindiret",
      "Chemelil/Chemase",
      "Kapsimotwo"
    ],
    "Aldai": [
      "Kabwareng",
      "Terik",
      "Kemeloi-maraba",
      "Kobujoi",
      "Kaptumo-kaboi",
      "Koyo-ndurio"
    ],
    "Nandi Hills": [
      "Nandi Hills",
      "Chepkunyuk",
      "Ol'Lessos",
      "Kapchorua"
    ],
    "Chesumei": [
      "Chemundu/Kapng'etuny",
      "Kosirai",
      "Lelmokwo/Ngechek",
      "Kaptel/Kamoiywo",
      "Kiptuya"
    ],
    "Emgwen": [
      "Chepkumia",
      "Kapkangani",
      "Kapsabet",
      "Kilibwoni"
    ],
    "Mosop": [
      "Chepterwai",
      "Kipkaren",
      "Kurgung/Surungai",
      "Kabiyet",
      "Ndalat",
      "Kabisaga",
      "Sangalo/Kebulonik"
    ]
  },
  "Narok": {
    "Kilgoris": [
      "Kilgoris Central",
      "Keyian",
      "Angata Barikoi",
      "Shankoe",
      "Kimintet",
      "Lolgorian"
    ],
    "Emurua Dikirr": [
      "Ilkerin",
      "Ololmasani",
      "Mogondo",
      "Kapsasian"
    ],
    "Narok North": [
      "Olpusimoru",
      "Olokurto",
      "Narok Town",
      "Nkareta",
      "Olorropil",
      "Melili"
    ],
    "Narok East": [
      "Mosiro",
      "Ildamat",
      "Keekonyokie",
      "Suswa"
    ],
    "Narok South": [
      "Majimoto/Naroosura",
      "Ololulung'A",
      "Melelo",
      "Loita",
      "Sogoo",
      "Sagamian"
    ],
    "Narok West": [
      "Ilmotiok",
      "Mara",
      "Siana",
      "Naikarra"
    ]
  },
  "Nyamira": {
    "Kitutu Masaba": [
      "Rigoma",
      "Gachuba",
      "Kemera",
      "Magombo",
      "Manga",
      "Gesima"
    ],
    "West Mugirango": [
      "Nyamaiya",
      "Bogichora",
      "Bosamaro",
      "Bonyamatuta",
      "Township"
    ],
    "North Mugirango": [
      "Itibo",
      "Bomwagamo",
      "Bokeira",
      "Magwagwa",
      "Ekerenyo"
    ],
    "Borabu": [
      "Mekenene",
      "Kiabonyoru",
      "Nyansiongo",
      "Esise"
    ]
  },
  "Nyandarua": {
    "Kinangop": [
      "Engineer",
      "Gathara",
      "North Kinangop",
      "Murungaru",
      "Njabini\\kiburu",
      "Nyakio",
      "Githabai",
      "Magumu"
    ],
    "Kipipiri": [
      "Wanjohi",
      "Kipipiri",
      "Geta",
      "Githioro"
    ],
    "Ol Kalou": [
      "Karau",
      "Kanjuiri Ridge",
      "Mirangine",
      "Kaimbaga",
      "Rurii"
    ],
    "Ol Jorok": [
      "Gathanji",
      "Gatimu",
      "Weru",
      "Charagita"
    ],
    "Ndaragwa": [
      "Leshau Pondo",
      "Kiriita",
      "Central",
      "Shamata"
    ]
  },
  "Nyeri": {
    "Tetu": [
      "Dedan Kimanthi",
      "Wamagana",
      "Aguthi/Gaaki"
    ],
    "Kieni": [
      "Mweiga",
      "Naromoru Kiamathaga",
      "Mwiyogo/Endarasha",
      "Mugunda",
      "Gatarakwa",
      "Thegu River",
      "Kabaru",
      "Gakawa"
    ],
    "Mathira": [
      "Ruguru",
      "Magutu",
      "Iriaini",
      "Konyu",
      "Kirimukuyu",
      "Karatina Town"
    ],
    "Othaya": [
      "Mahiga",
      "Iria-ini",
      "Chinga",
      "Karima"
    ],
    "Mukurweini": [
      "Gikondi",
      "Rugi",
      "Mukurwe-ini West",
      "Mukurwe-ini Central"
    ],
    "Nyeri Town": [
      "Kiganjo/Mathari",
      "Rware",
      "Gatitu/Muruguru",
      "Ruring'U",
      "Kamakwa/Mukaro"
    ]
  },
  "Samburu": {
    "Samburu West": [
      "Lodokejek",
      "Suguta Marmar",
      "Maralal",
      "Loosuk",
      "Poro"
    ],
    "Samburu North": [
      "El-barta",
      "Nachola",
      "Ndoto",
      "Nyiro",
      "Angata Nanyokie",
      "Baawa"
    ],
    "Samburu East": [
      "Waso",
      "Wamba West",
      "Wamba East",
      "Wamba North"
    ]
  },
  "Siaya": {
    "Ugenya": [
      "West Ugenya",
      "Ukwala",
      "North Ugenya",
      "East Ugenya"
    ],
    "Ugunja": [
      "Sidindi",
      "Sigomere",
      "Ugunja"
    ],
    "Alego Usonga": [
      "Usonga",
      "West Alego",
      "Central Alego",
      "Siaya Township",
      "North Alego",
      "South East Alego"
    ],
    "Gem": [
      "North Gem",
      "West Gem",
      "Central Gem",
      "Yala Township",
      "East Gem",
      "South Gem"
    ],
    "Bondo": [
      "West Yimbo",
      "Central Sakwa",
      "South Sakwa",
      "Yimbo East",
      "West Sakwa",
      "North Sakwa"
    ],
    "Rarieda": [
      "East Asembo",
      "West Asembo",
      "North Uyoma",
      "South Uyoma",
      "West Uyoma"
    ]
  },
  "Taita-Taveta": {
    "Taveta": [
      "Chala",
      "Mahoo",
      "Bomeni",
      "Mboghoni",
      "Mata"
    ],
    "Wundanyi": [
      "Wundanyi/Mbale",
      "Werugha",
      "Wumingu/Kishushe",
      "Mwanda/Mgange"
    ],
    "Mwatate": [
      "Rong'E",
      "Mwatate",
      "Bura",
      "Chawia",
      "Wusi/Kishamba"
    ],
    "Voi": [
      "Mbololo",
      "Sagalla",
      "Kaloleni",
      "Marungu",
      "Kasigau",
      "Ngolia"
    ]
  },
  "Tana River": {
    "Garsen": [
      "Kipini East",
      "Garsen South",
      "Kipini West",
      "Garsen Central",
      "Garsen West",
      "Garsen North"
    ],
    "Galole": [
      "Kinakomba",
      "Mikinduni",
      "Chewani",
      "Wayu"
    ],
    "Bura": [
      "Chewele",
      "Bura",
      "Bangale",
      "Sala",
      "Madogo"
    ]
  },
  "Tharaka-Nithi": {
    "Maara": [
      "Mitheru",
      "Muthambi",
      "Mwimbi",
      "Ganga",
      "Chogoria"
    ],
    "Chuka/Igambang'ombe": [
      "Mariani",
      "Karingani",
      "Magumoni",
      "Mugwe",
      "Igambang'Ombe"
    ],
    "Tharaka": [
      "Gatunga",
      "Mukothima",
      "Nkondi",
      "Chiakariga",
      "Marimanti"
    ]
  },
  "Trans Nzoia": {
    "Kwanza": [
      "Kapomboi",
      "Kwanza",
      "Keiyo",
      "Bidii"
    ],
    "Endebess": [
      "Chepchoina",
      "Endebess",
      "Matumbei"
    ],
    "Saboti": [
      "Kinyoro",
      "Matisi",
      "Tuwani",
      "Saboti",
      "Machewa"
    ],
    "Kiminini": [
      "Kiminini",
      "Waitaluk",
      "Sirende",
      "Hospital",
      "Sikhendu",
      "Nabiswa"
    ],
    "Cherangany": [
      "Sinyerere",
      "Makutano",
      "Kaplamai",
      "Motosiet",
      "Cherangany/Suwerwa",
      "Chepsiro/Kiptoror",
      "Sitatunga"
    ]
  },
  "Turkana": {
    "Turkana North": [
      "Kaeris",
      "Lake Zone",
      "Lapur",
      "Kaaleng/Kaikor",
      "Kibish",
      "Nakalale"
    ],
    "Turkana West": [
      "Kakuma",
      "Lopur",
      "Letea",
      "Songot",
      "Kalobeyei",
      "Lokichoggio",
      "Nanaam"
    ],
    "Turkana Central": [
      "Kerio Delta",
      "Kang'Atotha",
      "Kalokol",
      "Lodwar Township",
      "Kanamkemer"
    ],
    "Loima": [
      "Kotaruk/Lobei",
      "Turkwel",
      "Loima",
      "Lokiriama/Lorengippi"
    ],
    "Turkana South": [
      "Kaputir",
      "Katilu",
      "Lobokat",
      "Kalapata",
      "Lokichar"
    ],
    "Turkana East": [
      "Kapedo/Napeitom",
      "Katilia",
      "Lokori/Kochodin"
    ]
  },
  "Uasin Gishu": {
    "Soy": [
      "Moi'S Bridge",
      "Kapkures",
      "Ziwa",
      "Segero/Barsombe",
      "Kipsomba",
      "Soy",
      "Kuinet/Kapsuswa"
    ],
    "Turbo": [
      "Ngenyilel",
      "Tapsagoi",
      "Kamagut",
      "Kiplombe",
      "Kapsaos",
      "Huruma"
    ],
    "Moiben": [
      "Tembelio",
      "Sergoit",
      "Karuna/Meibeki",
      "Moiben",
      "Kimumu"
    ],
    "Ainabkoi": [
      "Kapsoya",
      "Kaptagat",
      "Ainabkoi/Olare"
    ],
    "Kapseret": [
      "Simat/Kapseret",
      "Kipkenyo",
      "Ngeria",
      "Megun",
      "Langas"
    ],
    "Kesses": [
      "Racecourse",
      "Cheptiret/Kipchamo",
      "Tulwet/Chuiyat",
      "Tarakwa"
    ]
  },
  "Vihiga": {
    "Vihiga": [
      "Lugaga-wamuluma",
      "South Maragoli",
      "Central Maragoli",
      "Mungoma"
    ],
    "Sabatia": [
      "Lyaduywa/Izava",
      "West Sabatia",
      "Chavakali",
      "North Maragoli",
      "Wodanga",
      "Busali"
    ],
    "Hamisi": [
      "Shiru",
      "Muhudu",
      "Shamakhokho",
      "Gisambai",
      "Banja",
      "Tambua",
      "Jepkoyai"
    ],
    "Luanda": [
      "Luanda Township",
      "Wemilabi",
      "Mwibona",
      "Luanda South",
      "Emabungo"
    ],
    "Emuhaya": [
      "North East Bunyore",
      "Central Bunyore",
      "West Bunyore"
    ]
  },
  "Wajir": {
    "Wajir North": [
      "Gurar",
      "Bute",
      "Korondile",
      "Malkagufu",
      "Batalu",
      "Danaba",
      "Godoma"
    ],
    "Wajir East": [
      "Wagberi",
      "Township",
      "Barwago",
      "Khorof/Harar"
    ],
    "Tarbaj": [
      "Elben",
      "Sarman",
      "Tarbaj",
      "Wargadud"
    ],
    "Wajir West": [
      "Arbajahan",
      "Hadado/Athibohol",
      "Ademasajide",
      "Wagalla/Ganyure"
    ],
    "Eldas": [
      "Eldas",
      "Della",
      "Lakoley South/Basir",
      "Elnur/Tula Tula"
    ],
    "Wajir South": [
      "Benane",
      "Burder",
      "Dadaja Bulla",
      "Habasswein",
      "Lagboghol South",
      "Ibrahim Ure",
      "Diif"
    ]
  },
  "West Pokot": {
    "Kapenguria": [
      "Riwo",
      "Kapenguria",
      "Mnagei",
      "Siyoi",
      "Endugh",
      "Sook"
    ],
    "Sigor": [
      "Sekerr",
      "Masool",
      "Lomut",
      "Weiwei"
    ],
    "Kacheliba": [
      "Suam",
      "Kodich",
      "Kapckok",
      "Kasei",
      "Kiwawa",
      "Alale"
    ],
    "Pokot South": [
      "Chepareria",
      "Batei",
      "Lelan",
      "Tapach"
    ]
  }
};
