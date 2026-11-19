import type { ReactNode } from 'react';
import { useDocumentTitle } from '../lib/storage';

function Ext({ to, children }: { to: string; children: ReactNode }) {
  return (
    <a href={to} target="_blank" rel="noopener noreferrer" className="text-accent underline underline-offset-2">
      {children}
    </a>
  );
}

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-line pt-8">
      <h2 className="mb-4 font-display text-2xl font-black uppercase tracking-tight">{title}</h2>
      <div className="space-y-3 font-serif text-lg leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}

const LIBRARIES: { name: string; license: string; url: string }[] = [
  { name: 'React, React DOM', license: 'MIT', url: 'https://github.com/facebook/react/blob/main/LICENSE' },
  { name: 'DOMPurify', license: 'Apache-2.0 / MPL-2.0', url: 'https://github.com/cure53/DOMPurify/blob/main/LICENSE' },
  { name: 'Lucide (icone)', license: 'ISC', url: 'https://github.com/lucide-icons/lucide/blob/main/LICENSE' },
  { name: 'Tailwind CSS', license: 'MIT', url: 'https://github.com/tailwindlabs/tailwindcss/blob/main/LICENSE' },
  { name: 'Font Archivo, Inter, JetBrains Mono, Newsreader (Google Fonts)', license: 'SIL Open Font License 1.1', url: 'https://openfontlicense.org' },
];

export default function LicensesPage() {
  useDocumentTitle('Licenze e crediti');
  return (
    <div className="mx-auto w-full max-w-3xl space-y-10 px-4 py-10 sm:px-8 sm:py-14">
      <header className="animate-rise">
        <p className="kicker mb-3">Note legali</p>
        <h1 className="font-display text-4xl font-black uppercase leading-none tracking-tight sm:text-5xl">
          Licenze e crediti
        </h1>
      </header>

      <Block title="Contenuti SCP">
        <p>
          I testi, i titoli e le immagini degli articoli provengono dal{' '}
          <Ext to="https://scp-wiki.wikidot.com">SCP Wiki</Ext> e sono distribuiti con licenza{' '}
          <Ext to="https://creativecommons.org/licenses/by-sa/3.0/deed.it">
            Creative Commons Attribuzione – Condividi allo stesso modo 3.0 (CC BY-SA 3.0)
          </Ext>
          . Ogni dossier riporta in fondo alla pagina autore, link alla fonte, licenza ed eventuali crediti di immagini e
          file multimediali, ricavati dal box &ldquo;Licensing / Citation&rdquo; dell&rsquo;articolo originale.
        </p>
        <p>
          Gli articoli sono mostrati in versione riformattata (impaginazione, stili e link adattati, elementi di
          navigazione del wiki rimossi). Queste versioni modificate sono distribuite con la stessa licenza CC BY-SA 3.0.
          Alcune immagini hanno licenze proprie (ad esempio CC BY 2.0): fa fede quella indicata nei crediti di ciascun
          dossier.
        </p>
        <p>
          I testi di presentazione in home sono adattati e tradotti da{' '}
          <Ext to="https://scp-wiki.wikidot.com/about-the-scp-foundation">&ldquo;About the SCP Foundation&rdquo;</Ext>{' '}
          e da <Ext to="https://scp-wiki.wikidot.com/scp-173">&ldquo;SCP-173&rdquo;</Ext> di Moto42, entrambi dal SCP
          Wiki, CC BY-SA 3.0.
        </p>
        <p>
          Il simbolo usato come logo è un adattamento del logo della SCP Foundation di Aelanna, CC BY-SA 3.0. Per i
          dettagli sulle licenze del wiki consulta la{' '}
          <Ext to="https://scp-wiki.wikidot.com/licensing-guide">Licensing Guide</Ext>.
        </p>
        <p>
          Questo sito è un progetto di fan indipendente: non è affiliato al SCP Wiki né approvato dai suoi autori.
        </p>
      </Block>

      <Block title="Dati">
        <p>
          I dati dell&rsquo;archivio sono letti dal dump statico{' '}
          <Ext to="https://github.com/scp-data/scp-api">SCP Data API</Ext> (scp-data.tedivm.com), generato con{' '}
          <Ext to="https://github.com/scp-data/scp_crawler">scp_crawler</Ext> di Robert Hafner (MIT). I contenuti che
          contiene restano soggetti alla licenza CC BY-SA 3.0 del wiki.
        </p>
      </Block>

      <Block title="Software e font">
        <ul className="divide-y divide-line border-y border-line font-sans text-base">
          {LIBRARIES.map((lib) => (
            <li key={lib.name} className="flex flex-wrap items-baseline justify-between gap-2 py-3">
              <span className="text-ink">{lib.name}</span>
              <Ext to={lib.url}>{lib.license}</Ext>
            </li>
          ))}
        </ul>
        <p className="text-base">Le note di copyright delle librerie sono incluse anche nel codice distribuito.</p>
      </Block>
    </div>
  );
}
