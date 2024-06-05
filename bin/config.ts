import { IAWSAmplifyStackProps } from "./types";

export const stackConfig: IAWSAmplifyStackProps = {
    roleName: 'nextjs-amplify-role',
    roleDesc: 'role used for amplify',
    secretName: 'amplify-hosting-git-token',
    appName: 'printhelix.com',
    appDesc: 'next app amplify webshop',
    gitOwner: 'afifpatel',
    gitRepo: 'next-tailwind-auth',
    gitBranch: 'main',
};