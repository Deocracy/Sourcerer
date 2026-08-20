import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution, WidgetFactory, bindViewContribution } from '@theia/core/lib/browser';
import { SourcererFaviconContribution } from './sourcerer-favicon-contribution';
import { SourcererWelcomeWidget } from './sourcerer-welcome-widget';
import { SourcererWelcomeViewContribution } from './sourcerer-welcome-contribution';

export default new ContainerModule(bind => {
    bind(SourcererFaviconContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(SourcererFaviconContribution);

    bind(SourcererWelcomeWidget).toSelf();
    bind(WidgetFactory).toDynamicValue(context => ({
        id: 'welcome', // D-43: the path is the factory id verbatim -- view:welcome
        createWidget: () => context.container.get<SourcererWelcomeWidget>(SourcererWelcomeWidget),
    })).inSingletonScope();
    bindViewContribution(bind, SourcererWelcomeViewContribution);
    bind(FrontendApplicationContribution).toService(SourcererWelcomeViewContribution);
});
