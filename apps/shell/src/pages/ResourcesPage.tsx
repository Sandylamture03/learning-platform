import { API } from '@lp/contracts';
import { ModuleOutlet } from '../ModuleOutlet.tsx';
import { Title } from '../ui.tsx';

const loadFinder = () => import('@lp/widgets/resource-finder');

export function ResourcesPage() {
  return (
    <div className="container">
      <Title>Resources</Title>
      <header className="page-head">
        <p className="eyebrow">Resources</p>
        <h1>Every free resource the tracks use</h1>
        <p className="page-head__lead">
          Search by title or site, or filter by track and type. Each lesson also links the few that matter for it.
        </p>
      </header>
      <ModuleOutlet load={loadFinder} src={API.resources} label="Resource finder" className="widget" />
    </div>
  );
}
