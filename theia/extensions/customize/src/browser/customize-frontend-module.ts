import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { CustomizeCssContribution } from './customize-css-contribution';

export default new ContainerModule(bind => {
    bind(CustomizeCssContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(CustomizeCssContribution);

    // The privileged-JS half (D-62..D-67, CUST-02) is added by Task 2.
});
