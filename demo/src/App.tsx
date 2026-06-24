import { Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './nav';
import { VIEWS } from './views.config';
import { VIEW_COMPONENTS } from './views';

function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<Navigate to="/chat/conversation" replace />} />
        {VIEWS.map(v => {
          const Component = VIEW_COMPONENTS[v.name];
          return <Route key={v.name} path={v.path} element={<Component />} />;
        })}
      </Route>
    </Routes>
  );
}

export default App;
