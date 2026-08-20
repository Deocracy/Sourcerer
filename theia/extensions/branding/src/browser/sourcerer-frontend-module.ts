import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution, WidgetFactory, bindViewContribution } from '@theia/core/lib/browser';
import { AboutDialog } from '@theia/core/lib/browser/about-dialog';
import { SourcererFaviconContribution } from './sourcerer-favicon-contribution';
import { SourcererWelcomeWidget } from './sourcerer-welcome-widget';
import { SourcererWelcomeViewContribution } from './sourcerer-welcome-contribution';
import { SourcererAboutDialog } from './sourcerer-about-dialog';

export default new ContainerModule((bind, _unbind, isBound, rebind) => {
    bind(SourcererFaviconContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(SourcererFaviconContribution);

    bind(SourcererWelcomeWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(context => ({
        id: 'welcome', // D-43: the path is the factory id verbatim -- view:welcome
        createWidget: () => context.container.get<SourcererWelcomeWidget>(SourcererWelcomeWidget),
    })).inSingletonScope();
    bindViewContribution(bind, SourcererWelcomeViewContribution);
    bind(FrontendApplicationContribution).toService(SourcererWelcomeViewContribution);

    // D-35: guarded rebind -- the in-tree idiom, keeps the module loadable
    // in a container where the base AboutDialog binding is absent.
    if (isBound(AboutDialog)) {
        rebind(AboutDialog).to(SourcererAboutDialog).inSingletonScope();
    } else {
        bind(AboutDialog).to(SourcererAboutDialog).inSingletonScope();
    }
});
