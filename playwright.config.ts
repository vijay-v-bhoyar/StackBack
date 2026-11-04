import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./tests',timeout:30000,expect:{timeout:6000},workers:1,use:{baseURL:'http://127.0.0.1:4793',headless:true,screenshot:'only-on-failure',trace:'retain-on-failure'},webServer:{command:'npm run build && npm run preview -- --port 4793 --strictPort',url:'http://127.0.0.1:4793',reuseExistingServer:false,timeout:60000}});

