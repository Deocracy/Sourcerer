import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { SourcererFaviconContribution } from './sourcerer-favicon-contribution';

export default new ContainerModule(bind => {
    bind(SourcererFaviconContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(SourcererFaviconContribution);
});
