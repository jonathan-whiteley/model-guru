help me brainstorm a plan for a Databricks App - ModelGuru

GOAL: Shift the creation of Genie spaces in databricks to be more Top Down: questions -> data rather than the other way around. Take a list of business questions and output a Metric View semantic model that can ultimately be used for high quality Genie spaces.

User Journey-
1: A user can upload a list of business questions (either paste in or drop in a xlsx/csv), usually 10-20 questions lets say. 
2. The app identifies the Measures, Dimensions, and Filters in those business questions, highlighting each data type in the question text (green for measure, blue for dims, grey for filters).  It then strips out all the unique measures, dimensions, and filter columns across all the questions. It will infer the name of a source database column that may comprise that measure, dimension, or filter. It will search the unity catalog {catalog.schema} defined upfront, for each measure/dimension's source column that could be used to compute it (if a calculated field) 

It will surface those to the user with a step to map to the ACTUAL column & table in Unity Catalog
EX:Business questions

- What were net sales by category last month?
- How many weekly units sold in west region?
- Show Y over Y performance of store 123 over last 12 months
- What were product XYZ’s gross sales last week?

Measures identified:

- Net sales
- Gross sales
- Units sold
Dims: 

- Region
- Product
- Date
- Store

Possible Tables Needed with % likelihood:
- see screenshot

3. It will output a simple ERD of a data model (prefer dimensional style model) using Excalidraw MCP and a scaffold of a Databricks Metric View yaml file to achieve that model and all metrics and dimensions within it (joins, calculated fields, etc accounted for). 

For the App APX , FASTAPI + React/Vite, i like the styling and components, design system used in this repo:
https://github.com/databricks-field-eng/vibe-coding-workshop-template