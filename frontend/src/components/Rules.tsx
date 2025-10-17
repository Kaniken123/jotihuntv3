import React, { useState } from 'react';
import { Book, Clock, Users, Camera, Trophy, MapPin, AlertTriangle, Info } from 'lucide-react';

const Rules: React.FC = () => {
  const [activeSection, setActiveSection] = useState<string>('overview');

  const sections = [
    { id: 'overview', title: 'Overzicht', icon: Info },
    { id: 'schedule', title: 'Schema & Tijden', icon: Clock },
    { id: 'safety', title: 'Veiligheid & Gedrag', icon: AlertTriangle },
    { id: 'teams', title: 'Scoutinggroepen', icon: Users },
    { id: 'foxes', title: 'Vossen', icon: MapPin },
    { id: 'hunts', title: 'Hunts', icon: Camera },
    { id: 'points', title: 'Punten', icon: Trophy },
    { id: 'other', title: 'Overige Regels', icon: Book },
  ];

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Jotihunt 2025 - Spelregels
        </h2>
        <div className="prose dark:prose-invert max-w-none">
          <p className="text-lg text-gray-700 dark:text-gray-300 mb-4">
            Welkom bij de Jotihunt 2025! In dit document vind je alle spelregels voor een eerlijke en veilige Jotihunt.
          </p>
          
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-6">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mt-0.5" />
              <div>
                <h3 className="font-semibold text-yellow-800 dark:text-yellow-200">Belangrijk</h3>
                <p className="text-yellow-700 dark:text-yellow-300 text-sm">
                  Bij twijfel, onduidelijkheid of tegenstrijdigheid is het standpunt van de organisatie van de Jotihunt bindend.
                  Wijzigingen kunnen zonder verdere kennisgeving worden gepubliceerd op www.jotihunt.nl.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            <div className="card p-4">
              <div className="flex items-center space-x-3 mb-2">
                <Clock className="w-5 h-5 text-primary-600" />
                <h3 className="font-semibold">Start & Einde</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                <strong>Start:</strong> Zaterdag 18 oktober 2025, 10:00 uur<br />
                <strong>Einde:</strong> Zondag 19 oktober 2025, 12:00 uur
              </p>
            </div>

            <div className="card p-4">
              <div className="flex items-center space-x-3 mb-2">
                <Users className="w-5 h-5 text-primary-600" />
                <h3 className="font-semibold">Deelname</h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Deelnamebijdrage: €27,50<br />
                Voor Scouts vanaf 14 jaar<br />
                Registratie verplicht
              </p>
            </div>
          </div>

          <h3 className="text-lg font-semibold mb-3">Belangrijkste Regels</h3>
          <ul className="space-y-2 text-gray-700 dark:text-gray-300">
            <li className="flex items-start space-x-2">
              <span className="text-primary-600 font-bold">•</span>
              <span>Veiligheid gaat voor alles - Nederlandse wet is van toepassing</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-primary-600 font-bold">•</span>
              <span>Reflecterend hesje verplicht tussen zonsondergang en zonsopgang</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-primary-600 font-bold">•</span>
              <span>Vossenteams worden toegewezen aan groepen</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-primary-600 font-bold">•</span>
              <span>Hunt codes binnen 30 minuten insturen</span>
            </li>
            <li className="flex items-start space-x-2">
              <span className="text-primary-600 font-bold">•</span>
              <span>1 uur wachttijd na hunt op hetzelfde vossenteam</span>
            </li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderSchedule = () => (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Schema & Tijden
        </h2>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Speelschema</h3>
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="font-medium">Start Jotihunt:</span>
                  <span>Za 18 okt 2025, 10:00</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Wisseling vossen:</span>
                  <span>Za 18 okt 2025, 23:00</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Einde Jotihunt:</span>
                  <span>Zo 19 okt 2025, 12:00</span>
                </div>
                <div className="flex justify-between">
                  <span className="font-medium">Sluitingstijd codes:</span>
                  <span>Zo 19 okt 2025, 12:15</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Speelhelften</h3>
            <div className="space-y-3">
              <div className="card p-4">
                <h4 className="font-semibold text-primary-600 dark:text-primary-400 mb-2">Eerste Helft</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  13 uur spelen (10:00 - 23:00)<br />
                  Originele vossenteams actief
                </p>
              </div>
              <div className="card p-4">
                <h4 className="font-semibold text-primary-600 dark:text-primary-400 mb-2">Tweede Helft</h4>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  13 uur spelen (23:00 - 12:00)<br />
                  Nieuwe, fitte vossenteams
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Vossenwisseling</h3>
          <p className="text-blue-700 dark:text-blue-300 text-sm">
            Om 23:00 uur worden alle vossen vervangen. Vossenteams gaan van 22:45 tot 23:15 op inactief.
            Het nieuwe vossenteam start nabij het eindpunt van het oude vossenteam.
          </p>
        </div>
      </div>
    </div>
  );

  const renderSafety = () => (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Veiligheid & Gedrag
        </h2>

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-6">
          <div className="flex items-start space-x-3">
            <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
            <div>
              <h3 className="font-semibold text-red-800 dark:text-red-200">Eerste Regel</h3>
              <p className="text-red-700 dark:text-red-300 text-sm">
                Veiligheid voor jezelf en de ander gaat voor alles. Let daarop en handel ernaar.
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Verplichtingen</h3>
            <ul className="space-y-3">
              <li className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-2 h-2 bg-primary-600 rounded-full mt-2"></div>
                <span className="text-sm">Nederlandse wet is van toepassing</span>
              </li>
              <li className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-2 h-2 bg-primary-600 rounded-full mt-2"></div>
                <span className="text-sm">Reflecterend hesje tussen zonsondergang en zonsopgang</span>
              </li>
              <li className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-2 h-2 bg-primary-600 rounded-full mt-2"></div>
                <span className="text-sm">Herkenbaar zijn via unieke herkenningscode</span>
              </li>
              <li className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-2 h-2 bg-primary-600 rounded-full mt-2"></div>
                <span className="text-sm">Houden aan openstellingstijden natuurgebieden</span>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Verboden</h3>
            <ul className="space-y-3">
              <li className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-2 h-2 bg-red-600 rounded-full mt-2"></div>
                <span className="text-sm">Vossenteam volgen (te voet, voertuig, drone, GPS)</span>
              </li>
              <li className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-2 h-2 bg-red-600 rounded-full mt-2"></div>
                <span className="text-sm">Organisatie-auto's volgen</span>
              </li>
              <li className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-2 h-2 bg-red-600 rounded-full mt-2"></div>
                <span className="text-sm">Overlast bezorgen aan omwonenden</span>
              </li>
              <li className="flex items-start space-x-3">
                <div className="flex-shrink-0 w-2 h-2 bg-red-600 rounded-full mt-2"></div>
                <span className="text-sm">Hunten zonder reflecterend hesje in het donker</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-6 p-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <h3 className="font-semibold text-orange-800 dark:text-orange-200 mb-2">Sancties</h3>
          <p className="text-orange-700 dark:text-orange-300 text-sm">
            Bij eerste waarschuwing: -10 punten. Bij tweede waarschuwing: gesprek op HQ en mogelijke diskwalificatie.
            Onveilig gedrag kan extra minpunten opleveren.
          </p>
        </div>
      </div>
    </div>
  );

  const renderHunts = () => (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Hunt Regels
        </h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Hunt Basisregels</h3>
            <div className="space-y-3">
              <div className="flex items-start space-x-3">
                <Camera className="w-5 h-5 text-primary-600 mt-1" />
                <div>
                  <p className="font-medium">Toegewezen vossenteams per groep</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Welke teams dit zijn wordt vooraf bekendgemaakt
                  </p>
                </div>
              </div>
              
              <div className="flex items-start space-x-3">
                <Clock className="w-5 h-5 text-primary-600 mt-1" />
                <div>
                  <p className="font-medium">30 minuten om hunt code in te sturen</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Vanaf het moment van contact met het vossenteam
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <AlertTriangle className="w-5 h-5 text-orange-600 mt-1" />
                <div>
                  <p className="font-medium">1 uur cooldown na hunt</p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Hetzelfde vossenteam niet opnieuw huntbaar
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Hunt Proces</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center space-x-2">
                <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold">1</span>
                <span>Contact maken met actieve lopers vossenteam</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold">2</span>
                <span>Veilige plek zoeken voor afhandeling</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold">3</span>
                <span>Unieke code ontvangen van vossenteam</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold">4</span>
                <span>Foto maken van sticker</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="flex-shrink-0 w-6 h-6 bg-primary-600 text-white rounded-full flex items-center justify-center text-xs font-bold">5</span>
                <span>Code + tijd + foto binnen 30 min insturen</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="card p-4 border-l-4 border-green-500">
            <h4 className="font-semibold text-green-800 dark:text-green-200 mb-2">Toegestaan</h4>
            <ul className="text-sm space-y-1">
              <li>• Hunten van actieve vossen (groen)</li>
              <li>• Hunten van vossen onderweg (oranje)</li>
              <li>• Andere vossenteams tijdens cooldown</li>
            </ul>
          </div>

          <div className="card p-4 border-l-4 border-red-500">
            <h4 className="font-semibold text-red-800 dark:text-red-200 mb-2">Niet Toegestaan</h4>
            <ul className="text-sm space-y-1">
              <li>• Hunten van inactieve vossen (rood)</li>
              <li>• Hunten binnen 500m van scoutinggroep</li>
              <li>• Hunten zonder registratie/herkenning</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );

  const renderPoints = () => (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Puntensysteem
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <div className="card p-4 text-center border-2 border-green-200 dark:border-green-800">
            <Trophy className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <h3 className="text-2xl font-bold text-green-600 dark:text-green-400">6 punten</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Eigen (hoofd) vossenteam</p>
          </div>

          <div className="card p-4 text-center border-2 border-blue-200 dark:border-blue-800">
            <Trophy className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400">3 punten</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Andere toegestane vossenteams</p>
          </div>

          <div className="card p-4 text-center border-2 border-purple-200 dark:border-purple-800">
            <Trophy className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <h3 className="text-2xl font-bold text-purple-600 dark:text-purple-400">2x</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">Happy Hour (indien actief)</p>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Overige Punten</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Hints</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Maximaal 1 punt per toegewezen vossenteam
              </p>
              <ul className="text-sm space-y-1">
                <li>• Volledig correcte oplossing binnen 20 minuten</li>
                <li>• Kan coördinaat, codewoord, postcode zijn</li>
                <li>• Exacte invoerwijze staat op website</li>
              </ul>
            </div>

            <div className="card p-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Opdrachten</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Punten variëren per opdracht
              </p>
              <ul className="text-sm space-y-1">
                <li>• Maximaal aantal punten staat bij opdracht</li>
                <li>• Beoordeling door organisatie</li>
                <li>• Groepslogo moet zichtbaar/hoorbaar zijn</li>
              </ul>
            </div>

            <div className="card p-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Tegenhunt</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Sticker zoeken bij je thuisbasis
              </p>
              <ul className="text-sm space-y-1">
                <li>• Start: -10 punten</li>
                <li>• Gevonden binnen 30 min: +20 punten</li>
                <li>• Binnen 500m van thuisbasis</li>
              </ul>
            </div>

            <div className="card p-4">
              <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">Sancties</h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                Minpunten voor overtredingen
              </p>
              <ul className="text-sm space-y-1">
                <li>• Eerste waarschuwing: -10 punten</li>
                <li>• Onveilig gedrag: variabele aftrek</li>
                <li>• Bij herhaling: mogelijke diskwalificatie</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderTeams = () => (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Scoutinggroepen
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Deelname Voorwaarden</h3>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start space-x-2">
                <span className="text-primary-600">€</span>
                <span>Deelnamebijdrage: €27,50 (via iDEAL bij inschrijving)</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-primary-600">🏠</span>
                <span>Thuislocatie in provincie Gelderland (tenzij anders overeengekomen)</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-primary-600">👥</span>
                <span>Voor Scouts vanaf 14 jaar (jongere deelname toegestaan)</span>
              </li>
              <li className="flex items-start space-x-2">
                <span className="text-primary-600">📱</span>
                <span>Telegram registratie verplicht voor tegenhunt berichten</span>
              </li>
            </ul>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Registratie Verplicht</h3>
            <div className="space-y-3">
              <div className="card p-3">
                <h4 className="font-medium mb-1">🚗 Gemotoriseerde voertuigen</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">Auto's, busjes, e-bikes, etc. + herkenningscode op voertuig</p>
              </div>
              <div className="card p-3">
                <h4 className="font-medium mb-1">🚲 Niet-gemotoriseerde voertuigen</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">Fietsen, steps, roeiboten, etc. + herkenningscode</p>
              </div>
              <div className="card p-3">
                <h4 className="font-medium mb-1">🚶 Hunters te voet</h4>
                <p className="text-xs text-gray-600 dark:text-gray-400">Herkenningscode bij zich hebben (papier of digitaal)</p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <h3 className="font-semibold text-red-800 dark:text-red-200 mb-2">Belangrijke Voorwaarden</h3>
          <ul className="text-red-700 dark:text-red-300 text-sm space-y-1">
            <li>• Deelname altijd op eigen risico - verzekering verplicht</li>
            <li>• Organisatie kan groepen te allen tijde uitsluiten</li>
            <li>• Geld wordt nooit terugbetaald</li>
            <li>• Foto's/opdrachten mogen gepubliceerd worden (AVG)</li>
            <li>• Contactgegevens 13 maanden bewaard</li>
          </ul>
        </div>
      </div>
    </div>
  );

  const renderFoxes = () => (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Vossenteams
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Team Samenstelling</h3>
            <div className="card p-4">
              <p className="text-sm mb-3">Een vossenteam bestaat uit <strong>3 personen</strong> die actief zijn in de eerste of tweede speelhelft.</p>
              <div className="space-y-2 text-sm">
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                  <span>Verplaatsing voornamelijk te voet</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <span>Foto beschikbaar op website bij start speelhelft</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
                  <span>Lijst deelnemende groepen om te bezoeken</span>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Verplaatsingsbudget</h3>
            <div className="card p-4">
              <p className="text-sm mb-3">Vooraf vastgesteld budget voor verplaatsing via:</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="flex items-center space-x-2">
                  <span>🚲</span><span>Fiets/step</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span>🚌</span><span>Openbaar vervoer</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span>🚗</span><span>Auto</span>
                </div>
                <div className="flex items-center space-x-2">
                  <span>⛵</span><span>Boot</span>
                </div>
              </div>
              <p className="text-xs text-gray-600 dark:text-gray-400 mt-2">
                Uitzondering: Openbaar veer (geen budget nodig)
              </p>
            </div>
          </div>
        </div>

        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Vossen Status</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card p-4 border-l-4 border-green-500">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
              <h4 className="font-semibold text-green-700 dark:text-green-300">Actief</h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Vossenteam mag gehunt worden. Normaal actief in het veld.
            </p>
          </div>

          <div className="card p-4 border-l-4 border-orange-500">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
              <h4 className="font-semibold text-orange-700 dark:text-orange-300">Onderweg</h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Vossenteam mag gehunt worden. Aan het verplaatsen met budget.
            </p>
          </div>

          <div className="card p-4 border-l-4 border-red-500">
            <div className="flex items-center space-x-2 mb-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <h4 className="font-semibold text-red-700 dark:text-red-300">Inactief</h4>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Vossenteam mag NIET gehunt worden. Grote verplaatsing of wisseling.
            </p>
          </div>
        </div>

        <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
          <h4 className="font-semibold text-blue-800 dark:text-blue-200 mb-2">Vossenwisseling (23:00 uur)</h4>
          <p className="text-blue-700 dark:text-blue-300 text-sm">
            Van 22:45 tot 23:15 zijn alle vossenteams inactief. Nieuwe teams starten nabij eindpunt van oude teams.
            Het spel gaat gewoon door, alleen de vossen worden vervangen.
          </p>
        </div>
      </div>
    </div>
  );

  const renderOther = () => (
    <div className="space-y-6">
      <div className="card p-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-4">
          Overige Belangrijke Regels
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Tegenhunt</h3>
            <div className="card p-4">
              <div className="space-y-3 text-sm">
                <p>Sticker wordt geplakt in de buurt van je scoutinggroep:</p>
                <ul className="space-y-1 ml-4">
                  <li>• Op verticaal oppervlak (0.5-1.7m hoogte)</li>
                  <li>• Zichtbaar vanaf openbare weg/pad</li>
                  <li>• Binnen 500m van thuisbasis</li>
                  <li>• In aangegeven windrichting</li>
                </ul>
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded">
                  <p className="font-medium">Proces:</p>
                  <p>1. Start: -10 punten via Telegram</p>
                  <p>2. 30 minuten om sticker te vinden</p>
                  <p>3. Gevonden: +20 punten totaal</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Opdrachten</h3>
            <div className="card p-4">
              <div className="space-y-3 text-sm">
                <p>Regelmatig gepubliceerd op website:</p>
                <ul className="space-y-1 ml-4">
                  <li>• Maximaal aantal punten staat vermeld</li>
                  <li>• Deadline voor inlevering</li>
                  <li>• Groepslogo/vlag moet zichtbaar zijn</li>
                  <li>• 3 manieren: afbeelding, tekst, YouTube link</li>
                </ul>
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded">
                  <p className="font-medium">Afbeelding eisen:</p>
                  <p>• Max 2MB, JPG/PNG formaat</p>
                  <p>• Horizontaal/landschap</p>
                  <p>• Geen digitale bewerking</p>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Contact & Klachten</h3>
            <div className="card p-4">
              <div className="space-y-3 text-sm">
                <div className="bg-yellow-100 dark:bg-yellow-900/20 p-3 rounded border border-yellow-300 dark:border-yellow-700">
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">Tijdens Jotihunt:</p>
                  <p className="text-yellow-700 dark:text-yellow-300">Alleen telefonisch contact mogelijk</p>
                  <p className="text-yellow-700 dark:text-yellow-300">Geen e-mail, social media, of chat</p>
                </div>
                <p>Telefoon nummer staat op website tijdens het spel.</p>
                <p className="font-medium">Direct melden bij organisatie:</p>
                <ul className="ml-4 space-y-1">
                  <li>• Overtredingen spelregels</li>
                  <li>• Veiligheidssituaties</li>
                  <li>• Negatieve incidenten</li>
                </ul>
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Prijzen & Uitslag</h3>
            <div className="card p-4">
              <div className="space-y-3 text-sm">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Trophy className="w-4 h-4 text-yellow-600" />
                    <span className="font-medium">Jotihunt Wisseltrofee</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 ml-6">Meeste punten totaal</p>
                  
                  <div className="flex items-center space-x-2">
                    <Trophy className="w-4 h-4 text-purple-600" />
                    <span className="font-medium">Crea-wisseltrofee</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 ml-6">Meeste crea-punten</p>
                  
                  <div className="flex items-center space-x-2">
                    <Trophy className="w-4 h-4 text-blue-600" />
                    <span className="font-medium">Deelgebied-trofee</span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-400 ml-6">Meeste punten in eigen deelgebied</p>
                </div>
                <p className="font-medium text-gray-700 dark:text-gray-300">
                  Over de uitslag valt niet te twisten.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'overview': return renderOverview();
      case 'schedule': return renderSchedule();
      case 'safety': return renderSafety();
      case 'teams': return renderTeams();
      case 'foxes': return renderFoxes();
      case 'hunts': return renderHunts();
      case 'points': return renderPoints();
      case 'other': return renderOther();
      default: return renderOverview();
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Spelregels Jotihunt 2025
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Alle regels en informatie die je nodig hebt voor een succesvolle Jotihunt
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* Sidebar Navigation */}
        <div className="lg:w-64 flex-shrink-0">
          <div className="card p-4 sticky top-6">
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">Secties</h3>
            <nav className="space-y-1">
              {sections.map((section) => {
                const Icon = section.icon;
                return (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      activeSection === section.id
                        ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100 dark:text-gray-400 dark:hover:text-gray-100 dark:hover:bg-gray-700'
                    }`}
                  >
                    <Icon size={16} />
                    <span>{section.title}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          {renderContent()}
        </div>
      </div>
    </div>
  );
};

export default Rules;